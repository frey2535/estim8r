import React from "react";
import {
  DRAWING_ACCEPT,
  DRAWING_INPUT_ID,
  handleNativeDrawingChange,
} from "@/domain/takeoff/drawingUpload";

export default function DrawingFileInput() {
  return (
    <input
      id={DRAWING_INPUT_ID}
      name="estim8r-drawing"
      type="file"
      accept={DRAWING_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => { void handleNativeDrawingChange(event); }}
    />
  );
}
