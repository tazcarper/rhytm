import { getInitials } from "./get-initials";

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Sizing + shape (e.g. "size-16 rounded-full", or "aspect-[4/5] w-full") — the component owns color/type/shadow, the caller owns size and shape. */
  className?: string;
  /** Initials text size — scale this up for a larger avatar. Defaults to a size that suits a ~64px circle. */
  initialsClassName?: string;
}

// A person's headshot slot — real photo when one's set, otherwise a
// branded initials monogram (deep property-ink background, the site's own
// display typeface, a soft shadow) rather than PropertyImage's
// filename-labeled placeholder, which is right for content photos but
// reads oddly for a person's own face. Used by the instructor hover card
// and the education page's instructor grid; reusable anywhere else a
// person photo is optional.
export function PersonAvatar({ name, photoUrl, className, initialsClassName = "text-lg" }: PersonAvatarProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden shadow-soft ${className ?? ""}`}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-property-ink text-property-on-primary">
          <span className={`font-property-display uppercase leading-none ${initialsClassName}`} aria-hidden="true">
            {getInitials(name)}
          </span>
        </div>
      )}
    </div>
  );
}
