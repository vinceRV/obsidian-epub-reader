declare module "epubjs" {
	export interface TocItem {
		href: string;
		label: string;
	}

	export interface Navigation {
		toc: TocItem[];
	}

	export interface Metadata {
		title: string;
	}

	export interface Locations {
		generate(chars: number): Promise<void>;
		locationFromCfi(cfiRange: string): number | string;
	}

	export interface Book {
		ready: Promise<void>;
		loaded: {
			navigation: Promise<Navigation>;
			metadata: Promise<Metadata>;
		};
		locations: Locations;
		renderTo(element: HTMLElement, options: { width: string; height: string }): Rendition;
		destroy(): void;
	}

	export interface Contents {
		document: Document;
		window: Window;
	}

	export interface Location {
		start: {
			cfi: string;
			href: string;
		};
	}

	export interface Annotations {
		remove(cfiRange: string, type: string): void;
		highlight(cfiRange: string, data: object, cb?: unknown, className?: string): void;
	}

	export interface Themes {
		register(name: string, styles: Record<string, Record<string, string>>): void;
		select(name: string): void;
	}

	export interface Rendition {
		location?: Location;
		annotations: Annotations;
		themes: Themes;
		display(target?: string): Promise<void>;
		prev(): Promise<void>;
		next(): Promise<void>;
		clear(): void;
		destroy(): void;
		on(event: string, cb: (...args: unknown[]) => void): void;
	}

	export default function ePub(input: ArrayBuffer): Book;
}

declare module "epubjs/types/locations" {
	import type { Locations } from "epubjs";

	export default Locations;
}

declare module "epubjs/types/rendition" {
	import type { Location } from "epubjs";

	export type { Location };
}
