// Menu management: categories, products with option groups, photos and per-branch availability.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { TASTE_NOTES } from '@tada/shared';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { parse, randomToken, slugify } from '../../lib/util.js';
import { assertBranchAccess, requireStaff } from '../../plugins/auth.js';
import { productInclude, serializeProduct, type ProductRow } from '../catalog/catalog.service.js';
import { audit } from './audit.js';

const money = z.number().int().min(0).max(1_000_000_000);
const slugField = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);

const categoryInput = z.object({
  slug: slugField.optional(),
  nameFa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  art: z.string().max(30).nullable().optional(),
  sort: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
});

const scale = z.number().int().min(0).max(5);
const optionInput = z.object({
  id: z.uuid().optional(),
  nameFa: z.string().trim().min(1).max(40),
  nameEn: z.string().trim().min(1).max(40),
  priceDelta: z.number().int().min(-100_000_000).max(100_000_000).default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sort: z.number().int().min(0).max(1000).default(0),
});
const groupInput = z
  .object({
    id: z.uuid().optional(),
    nameFa: z.string().trim().min(1).max(40),
    nameEn: z.string().trim().min(1).max(40),
    minSelect: z.number().int().min(0).max(10).default(0),
    maxSelect: z.number().int().min(1).max(10).default(1),
    sort: z.number().int().min(0).max(1000).default(0),
    options: z.array(optionInput).min(1).max(20),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: 'min_greater_than_max' });

const productInput = z.object({
  slug: slugField.optional(),
  categoryId: z.uuid(),
  kind: z.enum(['DRINK', 'FOOD', 'PACKAGED']),
  nameFa: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  descFa: z.string().trim().max(600).default(''),
  descEn: z.string().trim().max(600).default(''),
  art: z.string().max(30).nullable().optional(),
  basePrice: money,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sort: z.number().int().min(0).max(10000).default(0),
  allergens: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  taste: z
    .object({
      sweetness: scale, bitterness: scale, acidity: scale, body: scale, caffeine: scale,
      milk: z.boolean(), temperature: z.enum(['HOT', 'ICED', 'BOTH']), notes: z.array(z.enum(TASTE_NOTES)).max(6),
    })
    .nullable()
    .default(null),
  optionGroups: z.array(groupInput).max(8).default([]),
});

const availabilityInput = z.object({
  isAvailable: z.boolean().optional(),
  stock: z.number().int().min(0).max(100000).nullable().optional(),
  priceOverride: money.nullable().optional(),
});

const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

function tasteColumns(t: z.output<typeof productInput>['taste']) {
  return t
    ? { sweetness: t.sweetness, bitterness: t.bitterness, acidity: t.acidity, body: t.body, caffeine: t.caffeine, milk: t.milk, temperature: t.temperature, notes: t.notes }
    : { sweetness: null, bitterness: null, acidity: null, body: null, caffeine: null, milk: null, temperature: null, notes: [] };
}

export default async function staffCatalogRoutes(app: FastifyInstance) {
  const { db, config } = app.ctx;
  const owner = ['OWNER'] as const;

  // ------------------------------------------------------------ categories

  app.get('/categories', async (req) => {
    requireStaff(req);
    const categories = await db.category.findMany({ orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }], include: { _count: { select: { products: true } } } });
    return { categories };
  });

  app.post('/categories', async (req, reply) => {
    const staff = requireStaff(req, owner);
    const d = parse(categoryInput, req.body);
    const category = await db.category.create({ data: { ...d, slug: d.slug ?? (slugify(d.nameEn) || randomToken(4).toLowerCase()) } });
    await audit(db, { staffId: staff.id, action: 'category.create', entity: 'category', entityId: category.id, ip: req.ip });
    reply.status(201);
    return { category };
  });

  app.put('/categories/:id', async (req) => {
    const staff = requireStaff(req, owner);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const d = parse(categoryInput, req.body);
    const category = await db.category.update({ where: { id }, data: { ...d, ...(d.slug ? {} : { slug: undefined }) } });
    await audit(db, { staffId: staff.id, action: 'category.update', entity: 'category', entityId: id, ip: req.ip });
    return { category };
  });

  app.delete('/categories/:id', async (req) => {
    const staff = requireStaff(req, owner);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    if (await db.product.count({ where: { categoryId: id } })) throw badRequest('category_not_empty');
    await db.category.delete({ where: { id } });
    await audit(db, { staffId: staff.id, action: 'category.delete', entity: 'category', entityId: id, ip: req.ip });
    return { ok: true };
  });

  // ------------------------------------------------------------ products

  app.get('/products', async (req) => {
    requireStaff(req);
    const products = await db.product.findMany({ orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }], include: productInclude });
    return {
      products: products.map((p) => ({
        ...serializeProduct(p as ProductRow, null),
        isActive: p.isActive,
        basePrice: p.basePrice,
        optionGroups: p.optionGroups.map((g) => ({ ...g, options: g.options })),
      })),
    };
  });

  async function writeGroups(productId: string, groups: z.output<typeof productInput>['optionGroups']) {
    const existing = await db.optionGroup.findMany({ where: { productId }, include: { options: true } });
    const keepGroupIds = new Set(groups.map((g) => g.id).filter(Boolean) as string[]);
    await db.optionGroup.deleteMany({ where: { productId, id: { notIn: [...keepGroupIds] } } });
    for (const g of groups) {
      const known = g.id ? existing.find((e) => e.id === g.id) : undefined;
      const groupData = { nameFa: g.nameFa, nameEn: g.nameEn, minSelect: g.minSelect, maxSelect: g.maxSelect, sort: g.sort };
      const group = known
        ? await db.optionGroup.update({ where: { id: known.id }, data: groupData })
        : await db.optionGroup.create({ data: { ...groupData, productId } });
      const keepOptionIds = new Set(g.options.map((o) => o.id).filter(Boolean) as string[]);
      await db.option.deleteMany({ where: { groupId: group.id, id: { notIn: [...keepOptionIds] } } });
      for (const o of g.options) {
        const { id: oid, ...od } = o;
        const knownOpt = oid && known?.options.some((x) => x.id === oid);
        if (knownOpt) await db.option.update({ where: { id: oid }, data: od });
        else await db.option.create({ data: { ...od, groupId: group.id } });
      }
    }
  }

  app.post('/products', async (req, reply) => {
    const staff = requireStaff(req, owner);
    const d = parse(productInput, req.body);
    const { taste, optionGroups, ...rest } = d;
    const product = await db.product.create({
      data: { ...rest, slug: d.slug ?? (slugify(d.nameEn) || randomToken(4).toLowerCase()), ...tasteColumns(taste) },
    });
    await writeGroups(product.id, optionGroups);
    const branches = await db.branch.findMany({ select: { id: true } });
    await db.branchProduct.createMany({ data: branches.map((b) => ({ branchId: b.id, productId: product.id })), skipDuplicates: true });
    await audit(db, { staffId: staff.id, action: 'product.create', entity: 'product', entityId: product.id, ip: req.ip });
    reply.status(201);
    return { product: { id: product.id, slug: product.slug } };
  });

  app.put('/products/:id', async (req) => {
    const staff = requireStaff(req, owner);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const d = parse(productInput, req.body);
    const { taste, optionGroups, slug, ...rest } = d;
    const product = await db.product.update({ where: { id }, data: { ...rest, ...(slug ? { slug } : {}), ...tasteColumns(taste) } });
    await writeGroups(id, optionGroups);
    await audit(db, { staffId: staff.id, action: 'product.update', entity: 'product', entityId: id, data: { basePrice: d.basePrice }, ip: req.ip });
    return { product: { id: product.id, slug: product.slug } };
  });

  app.delete('/products/:id', async (req) => {
    const staff = requireStaff(req, owner);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    // Products that appear on orders are archived, not deleted, so invoices stay intact.
    const used = await db.orderItem.count({ where: { productId: id } });
    if (used) await db.product.update({ where: { id }, data: { isActive: false } });
    else await db.product.delete({ where: { id } });
    await audit(db, { staffId: staff.id, action: used ? 'product.archive' : 'product.delete', entity: 'product', entityId: id, ip: req.ip });
    return { ok: true, archived: used > 0 };
  });

  app.post('/products/:id/image', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const staff = requireStaff(req, owner);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw notFound('product_not_found');
    const file = await req.file();
    if (!file) throw badRequest('file_required');
    const type = IMAGE_TYPES[file.mimetype];
    if (!type) throw badRequest('unsupported_image_type');
    const buf = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    if (!type.magic(buf)) throw badRequest('file_content_mismatch');
    const name = `${randomToken(16)}.${type.ext}`;
    const path = resolve(config.UPLOAD_DIR, 'products', name);
    await pipeline(async function* () { yield buf; }, createWriteStream(path, { flags: 'wx' }));
    if (product.imageUrl?.startsWith('/uploads/products/')) {
      await unlink(resolve(config.UPLOAD_DIR, 'products', product.imageUrl.split('/').pop()!)).catch(() => undefined);
    }
    const imageUrl = `/uploads/products/${name}`;
    await db.product.update({ where: { id }, data: { imageUrl } });
    await audit(db, { staffId: staff.id, action: 'product.image', entity: 'product', entityId: id, ip: req.ip });
    return { imageUrl };
  });

  // ------------------------------------------------------------ availability per branch

  app.get('/branches/:id/availability', async (req) => {
    const staff = requireStaff(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    assertBranchAccess(staff, id);
    const [products, rows] = await Promise.all([
      db.product.findMany({ where: { isActive: true }, orderBy: [{ sort: 'asc' }], select: { id: true, nameFa: true, nameEn: true, basePrice: true, categoryId: true, art: true, imageUrl: true } }),
      db.branchProduct.findMany({ where: { branchId: id } }),
    ]);
    const byId = new Map(rows.map((r) => [r.productId, r]));
    return {
      items: products.map((p) => {
        const r = byId.get(p.id);
        return { ...p, isAvailable: r?.isAvailable ?? true, stock: r?.stock ?? null, priceOverride: r?.priceOverride ?? null };
      }),
    };
  });

  app.put('/branches/:branchId/availability/:productId', async (req) => {
    const staff = requireStaff(req);
    const { branchId, productId } = parse(z.object({ branchId: z.uuid(), productId: z.uuid() }), req.params);
    assertBranchAccess(staff, branchId);
    const d = parse(availabilityInput, req.body);
    if (staff.role === 'BARISTA' && d.priceOverride !== undefined) throw forbidden('price_change_forbidden');
    const row = await db.branchProduct.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId, isAvailable: d.isAvailable ?? true, stock: d.stock ?? null, priceOverride: d.priceOverride ?? null },
      update: d,
    });
    await audit(db, { staffId: staff.id, action: 'availability.update', entity: 'product', entityId: productId, data: { branchId, ...d }, ip: req.ip });
    return { availability: row };
  });
}
