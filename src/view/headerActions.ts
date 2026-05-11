import { ItemView, TFile } from 'obsidian';
import { NotesForAnythingView } from './binaryNotesView';

// WeakMap evita leak: quando a view é GC'd, a entry some sozinha.
const headerActionsByView = new WeakMap<ItemView, Set<HTMLElement>>();

export function mountHeaderActions(view: NotesForAnythingView): void {
  detachHeaderActions(view); // safety: limpa antes de adicionar (anti hot-reload duplication)
  const set = new Set<HTMLElement>();

  const toggleEl = view.addAction(
    'file-symlink',
    'Toggle source view',
    () => {
      void openSource(view);
    },
  );
  set.add(toggleEl);

  headerActionsByView.set(view, set);
}

export function detachHeaderActions(view: ItemView): void {
  const set = headerActionsByView.get(view);
  if (!set) return;
  for (const el of set) el.detach();
  headerActionsByView.delete(view);
}

async function openSource(view: NotesForAnythingView): Promise<void> {
  const companionPath = (view.getState() as { companionPath?: string }).companionPath;
  if (!companionPath) return;
  const binaryPath = view.registry.getBinaryFor(companionPath);
  if (!binaryPath) return;
  const binaryFile = view.app.vault.getAbstractFileByPath(binaryPath);
  if (!(binaryFile instanceof TFile)) return;
  // openFile na mesma leaf delega ao viewer default registrado (PDF++ se instalado, senão nativo).
  await view.leaf.openFile(binaryFile);
}
