import Alert, { AlertType } from "@jetbrains/ring-ui-built/components/alert/alert";

export type NoteProps = {
  type: AlertType;
  message: string;
  timeout?: number;
};

export const createSuccessNote = (message: string, timeout?: number): NoteProps => ({
  type: Alert.Type.SUCCESS,
  message,
  timeout,
});

export const createErrorNote = (message: string, timeout?: number): NoteProps => ({
  type: Alert.Type.ERROR,
  message,
  timeout,
});

export const createLoadingNote = (message: string, timeout?: number): NoteProps => ({
  type: Alert.Type.LOADING,
  message,
  timeout,
});
