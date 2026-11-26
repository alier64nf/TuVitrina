const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('../dist/index.js');

test('normalizeCubanWhatsApp accepts local 8-digit, 05, 535, and +53 formats', () => {
  assert.equal(contracts.normalizeCubanWhatsApp('51234567'), '+5351234567');
  assert.equal(contracts.normalizeCubanWhatsApp('05 123 4567'), '+5351234567');
  assert.equal(contracts.normalizeCubanWhatsApp('+53 5123-4567'), '+5351234567');
  assert.equal(contracts.normalizeCubanWhatsApp('71234567'), null);
});

test('validateStoreSlug rejects reserved or invalid slugs', () => {
  assert.equal(contracts.validateStoreSlug('Dulceria-Ana').valid, true);
  assert.equal(contracts.validateStoreSlug('Dulceria-Ana').normalized, 'dulceria-ana');
  assert.equal(contracts.validateStoreSlug('admin').valid, false);
  assert.equal(contracts.validateStoreSlug('ab').valid, false);
  assert.equal(contracts.validateStoreSlug('mi tienda').valid, false);
});

test('computeDiscountPercent and cents arithmetic avoid floating point errors', () => {
  assert.equal(contracts.toCents(19.99), 1999);
  assert.equal(contracts.fromCents(1999), 19.99);
  assert.equal(contracts.computeDiscountPercent(750, 1000), 25);
  assert.equal(contracts.computeDiscountPercent(1000, 1000), null);
  assert.equal(contracts.computeDiscountPercent(1200, 1000), null);
});

test('createProductSchema enforces max 3 variant attributes and compareAtPrice > price', () => {
  const valid = contracts.createProductSchema.safeParse({
    name: 'Camisa de lino',
    price: 2500,
    compareAtPrice: 3200,
    currency: 'CUP',
    variantAttributeNames: ['Talla', 'Color', 'Corte'],
    variants: [
      {
        label: 'M / Blanco / Clásico',
        attributes: { Talla: 'M', Color: 'Blanco', Corte: 'Clásico' },
        priceOverride: 2600,
        stock: 5,
      },
    ],
  });
  assert.equal(valid.success, true);

  const badPrice = contracts.createProductSchema.safeParse({
    name: 'Camisa de lino',
    price: 2500,
    compareAtPrice: 2000,
  });
  assert.equal(badPrice.success, false);

  const tooManyAttrs = contracts.createProductSchema.safeParse({
    name: 'Camisa',
    price: 1000,
    variantAttributeNames: ['A', 'B', 'C', 'D'],
  });
  assert.equal(tooManyAttrs.success, false);
});
