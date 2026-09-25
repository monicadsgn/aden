// Marca provisória da Aden (identidade ainda não definida). Trocar aqui.
export function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-[14px] bg-marca text-sobre-marca shadow-card">
        <span className="absolute -right-2 -bottom-2 size-6 rounded-full bg-destaque/70" aria-hidden />
        <span className="relative text-lg font-extrabold leading-none">a</span>
      </span>
      {!compacta && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">aden</span>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-texto-suave uppercase">gestão</span>
        </span>
      )}
    </span>
  );
}
