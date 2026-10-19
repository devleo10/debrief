import Image from "next/image";

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export default function Logo({ size = 22, withWordmark = true, className }: LogoProps) {
  return (
    <span className={className ? `logo ${className}` : "logo"}>
      <Image
        className="logo-mark"
        src="/debrief-mark.png"
        alt={withWordmark ? "" : "Debrief"}
        aria-hidden={withWordmark || undefined}
        width={size}
        height={size}
        priority
        draggable={false}
      />
      {withWordmark && (
        <span className="logo-word">
          DEBRIEF<span className="logo-slash">/</span>
        </span>
      )}
    </span>
  );
}
