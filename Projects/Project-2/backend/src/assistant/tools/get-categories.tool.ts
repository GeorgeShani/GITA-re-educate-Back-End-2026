import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { CategoriesService } from '@/catalog/categories.service';
import { AssistantTool } from './assistant-tool.interface';

@Injectable()
export class GetCategoriesTool implements AssistantTool {
  readonly mutating = false;

  readonly declaration: FunctionDeclaration = {
    name: 'get_categories',
    description:
      'The full category tree, so search_products can be scoped to a category slug.',
    parametersJsonSchema: { type: 'object', properties: {} },
  };

  constructor(private readonly categoriesService: CategoriesService) {}

  async execute(): Promise<unknown> {
    const tree = await this.categoriesService.findTree();

    const flatten = (
      nodes: Awaited<ReturnType<CategoriesService['findTree']>>,
    ): { slug: string; name: string }[] =>
      nodes.flatMap((node) => [
        { slug: node.slug, name: node.name },
        ...flatten(node.children),
      ]);

    return { categories: flatten(tree) };
  }
}
