'use client';

import { nudgeDialog } from '@/lib/useBackdropClose';

// Egységes „Bezárás” gomb az ablakok jobb felső sarkában (terv-3 121, asztalon; telefonon a lehúzható lap zár). A
// <dialog> első gyermeke: görgetéskor is az ablak tetején marad. Ugyanazt kérdezi, mint a kikattintás: ha most nem
// zárhat (canClose), az ablak megbillen. Használat – a useBackdropClose-zal közös szabályokkal:
//   const closing = { onClose: () => dialogRef.current.close(), canClose: () => !busy };
//   <dialog {...useBackdropClose(dialogRef, closing)}><DialogClose dialogRef={dialogRef} {...closing} />…
export default function DialogClose({ dialogRef, onClose, canClose = () => true, onBlocked }) {
  return (
    <div className="dialog-close-bar">
      <button
        type="button"
        className="dialog-close"
        onClick={() => {
          if (canClose()) (onClose ?? (() => dialogRef.current.close()))();
          else {
            nudgeDialog(dialogRef.current);
            onBlocked?.();
          }
        }}
      >
        Bezárás
      </button>
    </div>
  );
}
