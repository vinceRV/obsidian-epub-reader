import { TFile, FileView } from "obsidian";
import ePub, { Book, Rendition } from "epubjs";
import { NavigationTools } from "./epub-navigation-tools";
import { EpubThemes } from "./epub-themes";

export const EPUB_VIEW_TYPE = "obsidian-epub-reader";

export class EpubView extends FileView {
	private book: Book | null = null;
	private rendition: Rendition | null = null;
	private _navigationTools: NavigationTools | null = null;
	public file: TFile | null = null;

	getViewType(): string { return EPUB_VIEW_TYPE; }
	getDisplayText(): string { return this.file?.basename || "EPUB Reader"; }

	get navigationTools(): NavigationTools | null {
		return this._navigationTools;
	}

	set navigationTools(nav: NavigationTools | null) {
		this._navigationTools = nav;
	}

	setEphemeralState(): void {
		this._navigationTools?.hasFocus();
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.file = file;

		const arrayBuffer = await this.app.vault.readBinary(file);
		const container = this.containerEl.children[1];

		container.empty();

		const viewerDiv = container.createDiv({ cls: "epub-viewer" });

		this.book = ePub(arrayBuffer);
		this.rendition = this.book.renderTo(viewerDiv, { width: "100%", height: "100%" });
		this._navigationTools = new NavigationTools(viewerDiv, file.name, this.book, this.rendition);

		new EpubThemes(this.rendition);
		await this.rendition.display();
	}

	async onClose(): Promise<void> {
		this.rendition?.destroy();
		this.rendition = null;
		this.book?.destroy();
		this.book = null;
		this.containerEl.empty();
	}
}
