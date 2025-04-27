import { type Book, type Contents, type Rendition } from "epubjs";

export class NavigationTools {
	private tocPanel: HTMLDivElement;
	private isTOCOpen = false;
	private copyPanel: HTMLDivElement;
	private onNavigate: (href: string) => void;

	constructor(viewerDiv: HTMLElement, private bookRelativePath: string, private book: Book, private rendition: Rendition) {
		this.onNavigate = (href: string) => this.rendition.display(href);

		this.initLocations();
		this.createNavigationButton(viewerDiv, "epub-nav-prev", "❮", () => this.rendition.prev());
		this.createNavigationButton(viewerDiv, "epub-nav-next", "❯", () => this.rendition.next());
		this.createTocPanel(viewerDiv);
		this.addSelectionListener(viewerDiv);
	}

	async navigateToChapter(params: Record<string, string>): Promise<void> {
		if (params.cfi) {
			await this.rendition.display(params.cfi);
			this.rendition.annotations.remove("highlight", "highlight"); // Remove previous highlights
			this.rendition.annotations.highlight(params.cfi, {}, undefined, "highlight");
		} else if (params.href) {
			await this.rendition.display(params.href);
		} else {
			console.warn("No valid navigation parameter provided.");
		}
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

	private createNavigationButton(viewerDiv: HTMLElement, className: string, text: string, handler: () => void) {
		const btn = document.createElement("button");
		btn.className = `epub-button epub-nav-btn ${className}`;
		btn.textContent = text;
		btn.onclick = e => { e.stopPropagation(); handler(); };
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
			contents.document.addEventListener("mousedown", (event: MouseEvent) => {
				if (this.isTOCOpen) {
					this.toggleTOCVisibility(false);
				}
				this.copyPanel.classList.toggle("open", false);
			});
		});
	}

	private copyLinkToHrefToClipboard(e: Event, title: string, href: string, label: string) {
		e.stopPropagation();
		navigator.clipboard.writeText(`[[${this.bookRelativePath}#href=${href}|${title}, ${label}]]`);
		this.flipTextToCheckMark(e.currentTarget as HTMLButtonElement);
	}

	private copyLinkToCFIToClipboard(e: Event, title: string, cfiRange: string) {
		e.stopPropagation();

		const label = this.book.locations.locationFromCfi(cfiRange);
		navigator.clipboard.writeText(`[[${this.bookRelativePath}#cfi=${cfiRange}|${title}, p.${label}]]`);
		this.flipTextToCheckMark(e.currentTarget as HTMLButtonElement);
	}

	private copyQuoteAndLinkToClipboard(e: Event, title: string, cfiRange: string, selection: Selection) {
		e.stopPropagation();

		const label = this.book.locations.locationFromCfi(cfiRange);
		const selectedText = selection ? selection.toString().trim() : "";
		const quote = selectedText ? `> ${selectedText}\n-- ` : "";
		const link = `[[${this.bookRelativePath}#cfi=${cfiRange}|${title}, p.${label}]]`;
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

	private async initLocations() {
		await this.book.ready;
		if (!this.book.locations.length()) {
			await this.book.locations.generate(1000);
		}
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
		this.isTOCOpen = shouldShow;
	}
}
