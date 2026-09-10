import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';

import { IconGlyph, type IconName } from './icon-glyph';

/**
 * WYSIWYG body editor for the admin CMS (blog posts, static pages) — a
 * Tiptap 3 editor with a fixed toolbar. Emits `value` as an HTML string,
 * exactly what `Post.body` / `Page.body` already store and what the public
 * blog-post / content-page render through `[innerHTML]`, so nothing
 * downstream changes: this only replaces the raw `<textarea>`.
 *
 * StarterKit v3 already bundles bold/italic/underline/strike/code,
 * headings, both list kinds, blockquote, code block, horizontal rule,
 * link, and undo/redo — Image and Placeholder are the only add-ons.
 *
 * Only ever mounted under `/admin/**` (RenderMode.Client), so `new
 * Editor()` in the constructor never runs on the server.
 */
@Component({
  selector: 'rich-text-editor',
  imports: [TiptapEditorDirective, IconGlyph],
  template: `
    @if (label(); as text) {
      <span class="rte__label" [id]="labelId">{{ text }}</span>
    }
    <div class="rte">
      <div class="rte__bar" role="toolbar" aria-label="Text formatting">
        @for (group of toolbar; track $index) {
          <div class="rte__group">
            @for (item of group; track item.name) {
              <button
                type="button"
                class="rte__btn"
                [class.is-active]="isActive(item.name, item.attrs)"
                [attr.aria-pressed]="isActive(item.name, item.attrs)"
                [attr.aria-label]="item.title"
                [title]="item.title"
                (click)="item.run()"
              >
                <icon-glyph [name]="item.icon" [size]="16" />
              </button>
            }
          </div>
        }
        <div class="rte__group">
          <button
            type="button"
            class="rte__btn"
            aria-label="Undo"
            title="Undo"
            [disabled]="!canUndo()"
            (click)="editor.chain().focus().undo().run()"
          >
            <icon-glyph name="undo" [size]="16" />
          </button>
          <button
            type="button"
            class="rte__btn"
            aria-label="Redo"
            title="Redo"
            [disabled]="!canRedo()"
            (click)="editor.chain().focus().redo().run()"
          >
            <icon-glyph name="redo" [size]="16" />
          </button>
        </div>
      </div>

      <tiptap-editor
        class="rte__surface"
        [editor]="editor"
        [attr.aria-labelledby]="label() ? labelId : null"
      />
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .rte__label {
      @include type.caption-1-semi;
      display: block;
      margin-bottom: var(--space-2);
      color: var(--color-neutral-06);
    }

    .rte {
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-04);
      overflow: hidden;
      transition: box-shadow var(--duration-fast) var(--ease-out);

      &:focus-within {
        box-shadow: inset 0 0 0 1px var(--color-neutral-07);
      }
    }

    .rte__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2);
      border-bottom: 1px solid var(--color-neutral-03);
      background: var(--color-neutral-02);
    }

    .rte__group {
      display: flex;
      align-items: center;
      gap: 2px;

      &:not(:last-child)::after {
        content: '';
        width: 1px;
        height: 18px;
        margin: 0 var(--space-1);
        background: var(--color-neutral-03);
      }
    }

    .rte__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-sm);
      color: var(--color-neutral-06);
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);

      &:hover:not(:disabled) {
        background: var(--color-neutral-03);
        color: var(--color-neutral-07);
      }

      &.is-active {
        background: var(--color-neutral-07);
        color: var(--color-neutral-01);
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    // The Tiptap contenteditable surface. ::ng-deep because ProseMirror
    // builds this DOM itself, outside Angular's template compiler, so a
    // plain scoped rule never matches it — same reason blog-post.ts styles
    // its [innerHTML] body with ::ng-deep.
    .rte__surface {
      display: block;
      max-height: 420px;
      overflow-y: auto;
      background: var(--color-white);
    }

    ::ng-deep .rte-input {
      @include type.body-2;
      min-height: 220px;
      padding: var(--space-4);
      color: var(--color-neutral-07);
      outline: none;

      > * + * {
        margin-top: var(--space-3);
      }

      h1,
      h2,
      h3 {
        font-family: var(--font-poppins);
        font-weight: 600;
        color: var(--color-neutral-07);
        line-height: 1.3;
      }

      h1 {
        font-size: 1.5rem;
      }
      h2 {
        font-size: 1.25rem;
      }
      h3 {
        font-size: 1.05rem;
      }

      a {
        color: var(--color-info-text);
        text-decoration: underline;
      }

      ul,
      ol {
        padding-left: var(--space-6);
      }

      li > p {
        margin: 0;
      }

      blockquote {
        padding-left: var(--space-4);
        border-left: 3px solid var(--color-neutral-03);
        color: var(--color-neutral-05);
      }

      pre {
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-sm);
        background: var(--color-neutral-07);
        color: var(--color-neutral-01);
        font-size: 0.85em;
        overflow-x: auto;
      }

      code {
        padding: 0.1em 0.3em;
        border-radius: var(--radius-sm);
        background: var(--color-neutral-02);
        font-size: 0.9em;
      }

      pre code {
        padding: 0;
        background: none;
      }

      hr {
        border: none;
        border-top: 1px solid var(--color-neutral-03);
      }

      img {
        max-width: 100%;
        border-radius: var(--radius-sm);
      }

      // Placeholder extension — shows the text on the first empty line.
      p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        height: 0;
        color: var(--color-neutral-04);
        pointer-events: none;
      }
    }
  `,
})
export class RichTextEditor {
  readonly value = input<string>('');
  readonly valueChange = output<string>();
  readonly label = input<string>();
  readonly placeholder = input<string>('Write the content…');

  private readonly destroyRef = inject(DestroyRef);
  protected readonly labelId = `rte-${Math.random().toString(36).slice(2, 9)}`;

  // Bumped on every editor transaction so the toolbar's active/disabled
  // state (isActive / canUndo / canRedo) re-evaluates in change detection.
  private readonly rev = signal(0);

  protected readonly editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' },
        },
      }),
      Image.configure({ HTMLAttributes: { class: 'rte-image' } }),
      Placeholder.configure({ placeholder: () => this.placeholder() }),
    ],
    editorProps: { attributes: { class: 'rte-input' } },
    content: this.value(),
  });

  protected readonly toolbar: ToolbarItem[][] = [
    [
      this.mark('bold', 'Bold', 'bold', () => this.editor.chain().focus().toggleBold().run()),
      this.mark('italic', 'Italic', 'italic', () =>
        this.editor.chain().focus().toggleItalic().run(),
      ),
      this.mark('underline', 'Underline', 'underline', () =>
        this.editor.chain().focus().toggleUnderline().run(),
      ),
      this.mark('strike', 'Strikethrough', 'strikethrough', () =>
        this.editor.chain().focus().toggleStrike().run(),
      ),
      this.mark('code', 'Inline code', 'code', () =>
        this.editor.chain().focus().toggleCode().run(),
      ),
    ],
    [
      this.heading(2, 'Heading', 'heading-2'),
      this.heading(3, 'Subheading', 'heading-3'),
      this.mark('bulletList', 'Bulleted list', 'list', () =>
        this.editor.chain().focus().toggleBulletList().run(),
      ),
      this.mark('orderedList', 'Numbered list', 'list-ordered', () =>
        this.editor.chain().focus().toggleOrderedList().run(),
      ),
      this.mark('blockquote', 'Quote', 'text-quote', () =>
        this.editor.chain().focus().toggleBlockquote().run(),
      ),
    ],
    [
      {
        name: 'link',
        title: 'Link',
        icon: 'link',
        attrs: undefined,
        run: () => this.toggleLink(),
      },
      {
        name: '__image',
        title: 'Insert image',
        icon: 'image',
        attrs: undefined,
        run: () => this.insertImage(),
      },
    ],
  ];

  constructor() {
    this.editor.on('update', () => this.valueChange.emit(this.editor.getHTML()));
    this.editor.on('transaction', () => this.rev.update((n) => n + 1));

    effect(() => {
      const next = this.value() ?? '';
      // Sync external → editor only while the user isn't typing; our own
      // edits already flow out through value() and re-applying them would
      // collapse the selection to the document end on every keystroke.
      if (!this.editor.isFocused && next !== this.editor.getHTML()) {
        this.editor.commands.setContent(next, { emitUpdate: false });
      }
    });

    // ngx-tiptap's directive mounts the editor but never tears it down.
    this.destroyRef.onDestroy(() => this.editor.destroy());
  }

  protected isActive(name: string, attrs?: Record<string, unknown>): boolean {
    this.rev();
    if (name.startsWith('__')) return false;
    return this.editor.isActive(name, attrs);
  }

  protected canUndo(): boolean {
    this.rev();
    return this.editor.can().undo();
  }

  protected canRedo(): boolean {
    this.rev();
    return this.editor.can().redo();
  }

  private mark(name: string, title: string, icon: IconName, run: () => void): ToolbarItem {
    return { name, title, icon, attrs: undefined, run };
  }

  private heading(level: 1 | 2 | 3, title: string, icon: IconName): ToolbarItem {
    return {
      name: 'heading',
      title,
      icon,
      attrs: { level },
      run: () => this.editor.chain().focus().toggleHeading({ level }).run(),
    };
  }

  private toggleLink(): void {
    if (this.editor.isActive('link')) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('Link URL (https://…)')?.trim();
    if (!href) return;
    this.editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  private insertImage(): void {
    const src = window.prompt('Image URL')?.trim();
    if (!src) return;
    this.editor.chain().focus().setImage({ src }).run();
  }
}

interface ToolbarItem {
  /** Tiptap mark/node name for isActive(); `__`-prefixed for one-shot actions. */
  readonly name: string;
  readonly title: string;
  readonly icon: IconName;
  readonly attrs: Record<string, unknown> | undefined;
  readonly run: () => void;
}
