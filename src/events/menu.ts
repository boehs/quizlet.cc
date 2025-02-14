import { eventBus } from "../lib/event-bus";

export const menuEventChannel = eventBus<{
  createFolder: (setId?: string) => void;
  openImportDialog: () => void;
  folderWithSetCreated: (setId: string) => void;
  openChangelog: () => void;
}>();
