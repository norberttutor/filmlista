// Fokozatos elmosás a letapadt sávok alatt (terv-3 102, Norbi választása a látványterv után, 2026-10-15 –
// https://claude.ai/artifact/BDiSAgUT78ijod5PEMQLfs): egyforma üveg és éles vonal helyett a sáv mögött öt egymásra
// rétegzett, egyre erősebb elmosás (1–24 px), mindegyik lépcsőzetes maszkkal, így a sávtól távolodva a tartalom egyre
// kevésbé elmosott, és fokozatosan tűnik elő. edge: 'top' – a letapadt szűrősor (a sáv alá nyúlik). (A dokkolt
// lapozó – 'bottom' – 2026-10-15 óta a lábléc üvegét kapja, Norbi kérése.) A rétegek a sáv első gyermekei, a tartalma mögött (CSS:
// „Fokozatos elmosás”); a sáv maga nem kaphat backdrop-filtert, mert akkor a rétegek nem látnák a mögötte lévőt.
export default function ProgressiveBlur({ edge }) {
  return (
    <div className={`pblur pblur-${edge}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
