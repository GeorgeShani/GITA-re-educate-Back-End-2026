import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { OrderDocument } from './schemas/order.schema';

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

@Injectable()
export class InvoicePdfService {
  generate(order: OrderDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('3legant Golf', { align: 'left' });
      doc.fontSize(10).text('Invoice', { align: 'left' });
      doc.moveDown();

      doc.fontSize(12).text(`Order: ${order.orderNumber}`);
      const createdAt: Date = order.get('createdAt');
      doc.text(`Date: ${createdAt.toDateString()}`);
      doc.moveDown();

      doc.fontSize(11).text('Bill to:');
      doc.fontSize(10).text(order.billingAddress.fullName);
      doc.text(order.billingAddress.line1);
      if (order.billingAddress.line2) doc.text(order.billingAddress.line2);
      doc.text(
        `${order.billingAddress.city}, ${order.billingAddress.region ?? ''} ${order.billingAddress.postalCode}`,
      );
      doc.text(order.billingAddress.countryCode);
      doc.moveDown();

      doc.fontSize(11).text('Items:');
      for (const item of order.items) {
        doc
          .fontSize(10)
          .text(
            `${item.nameSnapshot} (${item.variantSku}) x${item.quantity} — ${formatMoney(item.lineTotalMinor, order.currency)}`,
          );
      }
      doc.moveDown();

      doc
        .fontSize(10)
        .text(`Subtotal: ${formatMoney(order.subtotalMinor, order.currency)}`);
      if (order.discountMinor > 0) {
        doc.text(
          `Discount: -${formatMoney(order.discountMinor, order.currency)}`,
        );
      }
      doc.text(`Shipping: ${formatMoney(order.shippingMinor, order.currency)}`);
      doc.text(`Tax: ${formatMoney(order.taxMinor, order.currency)}`);
      doc
        .fontSize(12)
        .text(`Total: ${formatMoney(order.totalMinor, order.currency)}`, {
          underline: true,
        });

      doc.end();
    });
  }

  /** Admin fulfillment document — shipping address + quantities, no pricing. */
  generatePackingSlip(order: OrderDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('3legant Golf', { align: 'left' });
      doc.fontSize(10).text('Packing Slip', { align: 'left' });
      doc.moveDown();

      doc.fontSize(12).text(`Order: ${order.orderNumber}`);
      const createdAt: Date = order.get('createdAt');
      doc.text(`Date: ${createdAt.toDateString()}`);
      doc.moveDown();

      doc.fontSize(11).text('Ship to:');
      doc.fontSize(10).text(order.shippingAddress.fullName);
      doc.text(order.shippingAddress.line1);
      if (order.shippingAddress.line2) doc.text(order.shippingAddress.line2);
      doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.region ?? ''} ${order.shippingAddress.postalCode}`,
      );
      doc.text(order.shippingAddress.countryCode);
      doc.moveDown();

      doc.fontSize(11).text('Items:');
      for (const item of order.items) {
        doc
          .fontSize(10)
          .text(
            `${item.nameSnapshot} (${item.variantSku}) — qty ${item.quantity}`,
          );
      }

      if (order.customerNote) {
        doc.moveDown();
        doc.fontSize(10).text(`Note: ${order.customerNote}`);
      }

      doc.end();
    });
  }
}
