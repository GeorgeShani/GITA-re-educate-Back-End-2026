import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_photos')
export class ProductPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  /** The S3 object key, needed to delete the object later. */
  @Column()
  key: string;

  /** The public CloudFront URL clients should use to display the photo. */
  @Column()
  url: string;

  @ManyToOne(() => Product, (product) => product.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
