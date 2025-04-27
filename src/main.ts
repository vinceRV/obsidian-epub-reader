import { Plugin, WorkspaceLeaf, Notice, TFile, Workspace, parseLinktext } from "obsidian";
import { around } from "monkey-around";
import { EpubView, EPUB_VIEW_TYPE } from "./epub-view";

export default class EpubViewerPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(EPUB_VIEW_TYPE, (leaf: WorkspaceLeaf) => new EpubView(leaf));
		this.registerExtensions(["epub"], EPUB_VIEW_TYPE);
		patchWorkspaceForEpub(this);
	}

	async openEpubAtChapter(file: TFile, params: Record<string, string>, newLeaf?: boolean): Promise<void> {
		if (!file) {
			new Notice("EPUB file not found.");
			return;
		}
		let leaf: WorkspaceLeaf | null = null;
		this.app.workspace.iterateAllLeaves(l => {
			if (l.view instanceof EpubView && l.view.file?.path === file.path) leaf = l;
		});
		if (!leaf) {
			leaf = this.app.workspace.getLeaf(newLeaf);
			await leaf.openFile(file, { active: true });
		} else {
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
		}
		await (leaf.view as EpubView).navigationTools?.navigateToChapter(params);
	}
}

const patchWorkspaceForEpub = (plugin: EpubViewerPlugin): void => {
	const app = plugin.app;
	plugin.register(
		around(Workspace.prototype, {
			openLinkText(old: (linktext: string, sourcePath: string, newLeaf?: boolean, openViewState?: Record<string, unknown>) => Promise<void> | void) {
				return function (linktext: string, sourcePath: string, newLeaf?: boolean, openViewState?: Record<string, unknown>) {
					const { path, subpath } = parseLinktext(linktext);
					const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
					if (file && file.extension === "epub") {
						const params = parseEpubSubpath(subpath);
						return plugin.openEpubAtChapter(file, params, newLeaf);
					}
					return old.call(this, linktext, sourcePath, newLeaf, openViewState);
				};
			}
		})
	);
};

function parseEpubSubpath(subpath?: string): Record<string, string> {
	if (!subpath) return {};
	if (subpath.startsWith("#")) subpath = subpath.slice(1);
	const params: Record<string, string> = {};
	for (const pair of subpath.split("&")) {
		const [key, value] = pair.split("=");
		if (key && value) params[key.trim()] = decodeURIComponent(value.trim());
	}
	return params;
}
