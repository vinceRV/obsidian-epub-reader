import type { Rendition } from "epubjs";

export class EpubThemes {
	private rendition: Rendition;
	private observer: MutationObserver;

	constructor(rendition: Rendition) {
		this.rendition = rendition;
		this.observer = new MutationObserver(() => {
			this.applyTheme();
		});
		this.observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["class"]
		});
		this.applyTheme();
	}

	private registerTheme(
		name: string,
		bg: string,
		fg: string,
		link: string,
		font: string,
		fontSize: string
	) {
		this.rendition.themes.register(name, {
			body: {
				background: bg,
				color: fg,
				"font-family": font,
				"font-size": fontSize
			},
			a: {
				color: link
			}
		});
	}

	private getCssVar(name: string, fallback: string): string {
		const value = getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
		return `${value} !important`;
	}

	private applyTheme() {
		const bgColor = this.getCssVar("--background-primary", "#fff");
		const fgColor = this.getCssVar("--text-normal", "#222");
		const linkColor = this.getCssVar("--link-color", "#0077cc");
		const fontFamily = this.getCssVar("--font-text", "sans-serif");
		const fontSize = this.getCssVar("--font-text-size", "1em");

		this.registerTheme("obsidian", bgColor, fgColor, linkColor, fontFamily, fontSize);
		this.rendition.themes.select("obsidian");
	}
}
