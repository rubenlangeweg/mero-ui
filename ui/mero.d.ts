/*! @rubenlangeweg/mero-ui 1.0.0 | MIT */
export type MeroTone = "accent" | "success" | "warning" | "danger";
export type MeroActionState = "pending" | "succeeded" | "rejected" | "unknown";
export type MeroDialogBackdropMode = "all" | "mero-only";

export interface MeroMessages {
  notificationsLabel?: string;
  dismissNotification?: string;
  copied?: string;
  copySelectPrompt?: string;
  copyBlocked?: string;
  previewLabel?: string;
  closePreview?: string;
  openPreview?: string;
  previewHint?: string;
  comboLoading?: string;
  comboEmpty?: string;
  comboError?: string;
  comboResultOne?: string;
  comboResultMany?: string;
  comboSuggestionOne?: string;
  comboSuggestionMany?: string;
  shortcutsOn?: string;
  shortcutsOff?: string;
  removeItem?: string;
  confirmTypePhrase?: string;
  confirmEnterReason?: string;
  confirmReady?: string;
  confirmUnknown?: string;
  confirmRejected?: string;
  formUnreachable?: string;
  formFailed?: string;
  actionSucceeded?: string;
  actionRejected?: string;
  actionUnknown?: string;
  searchError?: string;
  holdWarning?: string;
  dirtyLeaveWarning?: string;
  liveError?: string;
}

export interface MeroConfig {
  messages?: MeroMessages;
  locale?: string | null;
  dialogBackdrop?: MeroDialogBackdropMode;
}

export interface MeroResolvedConfig {
  readonly locale: string | null;
  readonly dialogBackdrop: MeroDialogBackdropMode;
  readonly messages: Readonly<Required<Pick<MeroMessages,
    | "notificationsLabel" | "dismissNotification" | "copied" | "copySelectPrompt" | "copyBlocked"
    | "previewLabel" | "closePreview" | "openPreview" | "previewHint"
    | "comboLoading" | "comboEmpty" | "comboError"
    | "comboResultOne" | "comboResultMany" | "comboSuggestionOne" | "comboSuggestionMany"
    | "shortcutsOn" | "shortcutsOff" | "removeItem">> & MeroMessages>;
}

export interface MeroOpenOptions {
  trigger?: Element | null;
}

export interface MeroCloseOptions {
  focus?: Element | string | null;
  value?: string;
  preserveToasts?: boolean;
}

export interface MeroToastOptions {
  tone?: MeroTone;
  duration?: number;
  trigger?: Element | null;
}

export interface MeroAPI {
  open(ref: HTMLDialogElement | string, options?: MeroOpenOptions): void;
  close(ref: HTMLDialogElement | string, options?: MeroCloseOptions): void;
  toast(message: string, options?: MeroToastOptions): HTMLDivElement | undefined;
  init(root?: Document | Element, trigger?: Element | null): void;
  cleanup(root?: Document | Element): void;
  configure(options?: MeroConfig): MeroResolvedConfig;
}

export interface MeroActionEventDetail {
  state: MeroActionState;
  status?: number;
  message?: string | null;
  source: Element;
  id: string | null;
}

export interface MeroTabEventDetail {
  tab: Element;
  panel: HTMLElement | null;
}

export interface MeroToggleEventDetail {
  pressed: boolean;
}

export type MeroSelectionEventDetail =
  | { value: string; option: Element }
  | { values: string[]; added: string | null; removed: string | null; option: Element | null };

export interface MeroSelectEventDetail {
  value: string;
  label: string;
  option: Element;
}

export interface MeroDialogEventDetail {
  open: boolean;
  dialog: HTMLDialogElement;
  returnValue: string;
}

export interface MeroPeekEventDetail {
  open: boolean;
  key: string | null;
  href: string | null;
  link: Element | null;
  panel: HTMLElement | null;
}

export interface MeroDirtyEventDetail {
  dirty: boolean;
  form: HTMLFormElement;
}

export interface MeroBoostUnmatchedEventDetail {
  source: Element | null;
  status: number;
  method: string;
  url: string;
  text: string;
  response: unknown;
}

export interface MeroEventMap {
  "mero:action": CustomEvent<MeroActionEventDetail>;
  "mero:tab": CustomEvent<MeroTabEventDetail>;
  "mero:toggle": CustomEvent<MeroToggleEventDetail>;
  "mero:selection": CustomEvent<MeroSelectionEventDetail>;
  "mero:select": CustomEvent<MeroSelectEventDetail>;
  "mero:dialog": CustomEvent<MeroDialogEventDetail>;
  "mero:peek": CustomEvent<MeroPeekEventDetail>;
  "mero:dirty": CustomEvent<MeroDirtyEventDetail>;
  "mero:boost-unmatched": CustomEvent<MeroBoostUnmatchedEventDetail>;
  "mero:query": CustomEvent<undefined>;
  "mero:refresh": CustomEvent<undefined>;
  "mero:toast": CustomEvent<{ message: string } & MeroToastOptions>;
  "mero:form-saved": CustomEvent<{ message?: string; target?: string }>;
}

declare global {
  interface Window {
    MeroUI: Readonly<MeroAPI>;
  }
  interface GlobalEventHandlersEventMap extends MeroEventMap {}
  interface DocumentEventMap extends MeroEventMap {}
  interface WindowEventMap extends MeroEventMap {}
}
