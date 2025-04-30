import { type Book, type Contents, type Rendition } from "epubjs";
import Locations from "epubjs/types/locations";
import { Location } from "epubjs/types/rendition";

export class NavigationTools {
	private tocPanel: HTMLDivElement;
	private isTOCOpen = false;
	private copyPanel: HTMLDivElement;
	private locations: Promise<Locations>;
	private highlight: string | null = null;
	private onNavigate: (href: string) => void;

	private currentLocation: Location | null = null;
	private needCorrection = false;

	constructor(viewerDiv: HTMLElement, private bookRelativePath: string, private book: Book, private rendition: Rendition) {
		this.onNavigate = (href: string) => this.rendition.display(href);

		this.locations = this.generateLocations();
		this.createNavigationButton(viewerDiv, "epub-nav-prev", "❮", async () => this.rendition.prev());
		this.createNavigationButton(viewerDiv, "epub-nav-next", "❯", async () => this.rendition.next());
		this.createTocPanel(viewerDiv);
		this.addSelectionListener(viewerDiv);
		this.addKeyListeners();

		// handle focus and resize events
		this.rendition.on("relocated", async (loc: Location) => {
			if (this.needCorrection) {
				this.needCorrection = false;
				this.rendition.display(this.currentLocation?.start.cfi);
			} else {
				this.currentLocation = loc;
			}
		});

		this.rendition.on("resized", async (e: unknown) => {
			this.needCorrection = true;
		});
	}

	async hasFocus(): Promise<void> {
		this.needCorrection = true;
	}

	async navigateToLocation(params: Record<string, string>): Promise<void> {
		this.needCorrection = false;

		if (this.highlight) {
			this.rendition.annotations.remove(this.highlight, "highlight");
			this.highlight = null;
			this.rendition.clear();
		}

		if (params.cfi) {
			this.highlight = params.cfi;
			this.rendition.annotations.highlight(params.cfi, {}, undefined, "highlight");
			await this.rendition.display(params.cfi);
		} else if (params.href) {
			await this.rendition.display(params.href);
		} else {
			console.warn("No valid navigation parameter provided.");
		}
	}

	private addKeyListeners() {
		this.rendition.on("rendered", (section: unknown, contents: Contents) => {
			contents.document.addEventListener("keydown", async (event: KeyboardEvent) => {
				if (event.key === "ArrowLeft") {
					this.rendition.prev();
					event.preventDefault();
				} else if (event.key === "ArrowRight") {
					this.rendition.next();
					event.preventDefault();
				} else if (event.key === "PageUp" || event.key === "PageDown") {
					const toc = await this.book.loaded.navigation;
					const currentHref = this.rendition.location?.start?.href;
					const tocItems = toc.toc;
					const idx = tocItems.findIndex(item => this.sanitize(item.href) === this.sanitize(currentHref));
					let targetIdx = -1;
					if (event.key === "PageUp" && idx < tocItems.length - 1) {
						targetIdx = idx + 1;
					} else if (event.key === "PageDown" && idx > 0) {
						targetIdx = idx - 1;
					}
					if (targetIdx !== -1) {
						const targetHref = this.sanitize(tocItems[targetIdx].href);
						await this.rendition.display(targetHref);
						event.preventDefault();
					}
				}
			});

			// keep the focus on the iframe
			(contents.document.body as HTMLElement).setAttribute("tabindex", "0");
			(contents.document.body as HTMLElement).focus();
		});
	}

	private async addSelectionListener(viewerDiv: HTMLElement) {
		const metadata = await this.book.loaded.metadata;
		const title = metadata.title;

		this.copyPanel = document.createElement("div");
		this.copyPanel.className = "epub-cfi-popup";
		this.createCopyButton(this.copyPanel, "epub-cfi-copy", "Copy link to this location", "🗎");
		this.createCopyButton(this.copyPanel, "epub-cfi-quote", "Copy quote and link to this location", "❝");
		viewerDiv.appendChild(this.copyPanel);

		this.rendition.on("selected", (cfiRange: string, contents: Contents) => {
			if (cfiRange && cfiRange.length > 0) {
				const selection = contents.window.getSelection();
				if (!selection || selection.rangeCount === 0) return;

				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				const iframeRect = contents.document.defaultView?.frameElement?.getBoundingClientRect();
				const viewerRect = viewerDiv.getBoundingClientRect();
				let left, top;

				if (iframeRect) {
					left = rect.left + iframeRect.left - viewerRect.left;
					top = rect.bottom + iframeRect.top - viewerRect.top + 2;
				} else {
					left = rect.left - viewerRect.left;
					top = rect.bottom - viewerRect.top + 2;
				}
				this.copyPanel.style.left = `${left}px`;
				this.copyPanel.style.top = `${top}px`;

				this.setCopyHandler(".epub-cfi-copy", (e) => this.copyLinkToCFIToClipboard(e, title, cfiRange));
				this.setCopyHandler(".epub-cfi-quote", (e) => this.copyQuoteAndLinkToClipboard(e, title, cfiRange, selection));
				this.copyPanel.classList.add("open");
			}
		});
	}

	private createNavigationButton(viewerDiv: HTMLElement, className: string, text: string, handler: () => Promise<void>) {
		const btn = document.createElement("button");
		btn.className = `epub-button epub-nav-btn ${className}`;
		btn.textContent = text;
		btn.onclick = async (e) => {
			e.stopPropagation();
			this.toggleTOCVisibility(false);
			handler();
		};
		viewerDiv.append(btn);
	}

	private async createTocPanel(viewerDiv: HTMLElement) {
		const toc = await this.book.loaded.navigation;
		const metadata = await this.book.loaded.metadata;
		const bookTitle = metadata.title;
		const tocButton = document.createElement("button");

		tocButton.className = "epub-button epub-toc-button";
		tocButton.title = "Show Table of Contents";
		tocButton.innerHTML = "☰";
		tocButton.onclick = () => this.toggleTOCVisibility();
		viewerDiv.appendChild(tocButton);

		this.tocPanel = document.createElement("div");
		this.tocPanel.className = "epub-toc-panel";
		viewerDiv.appendChild(this.tocPanel);
		this.tocPanel.innerHTML = "";

		for (const item of toc.toc) {
			const safeHref = this.sanitize(item.href);
			const safeLabel = this.sanitize(item.label);
			const tocLink = document.createElement("div");

			tocLink.className = "epub-toc-link";
			tocLink.dataset.href = safeHref;
			tocLink.dataset.label = safeLabel;

			const labelSpan = document.createElement("span");

			labelSpan.className = "epub-toc-label";
			labelSpan.textContent = safeLabel;

			const copyBtn = document.createElement("button");

			copyBtn.className = "epub-toc-copy";
			copyBtn.title = "Copy link";
			copyBtn.dataset.href = safeHref;
			copyBtn.dataset.label = safeLabel;
			copyBtn.tabIndex = -1;
			copyBtn.textContent = "🔗";
			copyBtn.onclick = (e) => this.copyLinkToHrefToClipboard(e, bookTitle, safeHref, safeLabel);

			tocLink.append(labelSpan, copyBtn);
			tocLink.onclick = () => this.onNavigate(safeHref);
			this.tocPanel.appendChild(tocLink);
		}

		// hide the TOC panel when clicking outside of it
		this.rendition.on("rendered", (_section: never, contents: Contents) => {
			contents.document.addEventListener("mousedown", () => {
				this.toggleTOCVisibility(false);
			});
		});
	}

	private copyLinkToHrefToClipboard(e: Event, title: string, href: string, label: string) {
		e.stopPropagation();
		navigator.clipboard.writeText(`[[${this.bookRelativePath}#href=${href}|${title}, ${label}]]`);
		this.flipTextToCheckMark(e.currentTarget as HTMLButtonElement);
	}

	private async copyLinkToCFIToClipboard(e: Event, title: string, cfiRange: string) {
		e.stopPropagation();

		const locations = await this.locations;
		const location = locations.locationFromCfi(cfiRange);
		navigator.clipboard.writeText(`[[${this.bookRelativePath}#cfi=${cfiRange}|${title}, loc.${location}]]`);
		this.flipTextToCheckMark(e.currentTarget as HTMLButtonElement);
	}

	private async copyQuoteAndLinkToClipboard(e: Event, title: string, cfiRange: string, selection: Selection) {
		e.stopPropagation();

		const locations = await this.locations;
		const location = locations.locationFromCfi(cfiRange);
		const selectedText = selection ? selection.toString().trim() : "";
		const quote = selectedText ? `> ${selectedText}\n-- ` : "";
		const link = `[[${this.bookRelativePath}#cfi=${cfiRange}|${title}, loc.${location}]]`;
		navigator.clipboard.writeText(`${quote}${link}`);
		this.flipTextToCheckMark(e.currentTarget as HTMLButtonElement);
	}

	private createCopyButton(copyPanel: HTMLDivElement, className: string, title: string, icon: string) {
		const btn = document.createElement("button");
		btn.className = `epub-button epub-cfi-popup-btn ${className}`;
		btn.title = title;
		btn.textContent = icon;
		copyPanel.appendChild(btn);
	}

	private flipTextToCheckMark(btn: HTMLButtonElement) {
		const originalText = btn.textContent;
		btn.textContent = "✔";
		setTimeout(() => btn.textContent = originalText, 1000);
	}

	private async generateLocations() {
		await this.book.ready;
		await this.book.locations.generate(1000);
		return this.book.locations;
	}

	private sanitize(str: string): string {
		// ultra-basic sanitization
		return str.replace(/[^\x20-\x7E]+/g, "").trim();
	}

	private setCopyHandler(className: string, handler: (e: Event) => void) {
		const copyBtn = this.copyPanel.querySelector(className) as HTMLButtonElement;
		copyBtn.onclick = handler;
	}

	private toggleTOCVisibility(show?: boolean) {
		const shouldShow = show !== undefined ? show : !this.isTOCOpen;
		this.tocPanel.classList.toggle("open", shouldShow);
		this.copyPanel.classList.toggle("open", false);
		this.isTOCOpen = shouldShow;
	}
}
