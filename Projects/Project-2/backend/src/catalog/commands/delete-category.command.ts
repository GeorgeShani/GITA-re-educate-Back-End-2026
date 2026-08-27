export class DeleteCategoryCommand {
  constructor(
    readonly categoryId: string,
    readonly correlationId: string,
  ) {}
}
