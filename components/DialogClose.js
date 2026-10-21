'use client';

import { nudgeDialog } from '@/lib/useBackdropClose';
import { useSheetDrag } from '@/lib/useSheetDrag';

// Egységes bezárás minden ablakban – a <dialog> első gyermeke. Asztalon „Bezárás” gomb a jobb felső sarokban
// (terv-3 121), görgetéskor is az ablak tetején marad; telefonon az ablak alsó lap, fent fogantyú: lefelé húzva
// zár (terv-3 122). Mindkettő ugyanazt kérdezi, mint a kikattintás: ha most nem zárhat (canClose), az ablak
// megbillen. Használat – a useBackdropClose-zal közös szabályokkal:
//   const closing = { onClose: () => dialogRef.current.close(), canClose: () => !busy };
//   <dialog {...useBackdropClose(dialogRef, closing)}><DialogClose dialogRef={dialogRef} {...closing} />…
export default function DialogClose({ dialogRef, onClose, canClose = () => true, onBlocked }) {
  const close = () => (onClose ? onClose() : dialogRef.current?.close());
  const sheetDrag = useSheetDrag(dialogRef, close, { canClose, onBlocked });
  return (
    <>
      {/* span: az ablakok „> div” szabályai ne érjék el */}
      <span className="sheet-handle" aria-hidden="true" {...sheetDrag} />
      <div className="dialog-close-bar">
        <button
          type="button"
          className="dialog-close"
          onClick={() => {
            if (canClose()) close();
            else {
              nudgeDialog(dialogRef.current);
              onBlocked?.();
            }
          }}
        >
          Bezárás
        </button>
      </div>
    </>
  );
}
