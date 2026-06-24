import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { toast } from "sonner";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const OUTPUT_SIZE = 512;

type ProfileAvatarUploaderProps = {
  displayName: string;
  avatarUrl?: string | null;
  onAvatarUpdated: (url: string) => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function ProfileAvatarUploader({
  displayName,
  avatarUrl,
  onAvatarUpdated,
}: ProfileAvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.12);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const resetEditor = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(null);
    setOffset({ x: 0, y: 0 });
    setZoom(1.12);
    imageRef.current = null;
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("אפשר להעלות JPG, PNG או WebP בלבד");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("התמונה גדולה מדי. מגבלה: 6MB");
      return;
    }

    resetEditor();
    const nextUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSourceUrl(nextUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(nextUrl);
      toast.error("לא ניתן לקרוא את התמונה");
    };
    image.src = nextUrl;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!sourceUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const renderCroppedBlob = async () => {
    const image = imageRef.current;
    if (!image) return null;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#101720";
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.save();
    context.beginPath();
    context.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    context.clip();

    const baseScale = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
    const drawWidth = image.width * baseScale * zoom;
    const drawHeight = image.height * baseScale * zoom;
    const offsetScale = OUTPUT_SIZE / 224;
    const drawX = (OUTPUT_SIZE - drawWidth) / 2 + offset.x * offsetScale;
    const drawY = (OUTPUT_SIZE - drawHeight) / 2 + offset.y * offsetScale;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.restore();

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.86);
    });
  };

  const saveAvatar = async () => {
    setSaving(true);
    try {
      const blob = await renderCroppedBlob();
      if (!blob) {
        toast.error("לא ניתן להכין את התמונה");
        return;
      }

      const url = await RemoteStorageService.uploadCurrentUserAvatar(blob);
      if (!url) {
        toast.error("שגיאה בהעלאת התמונה");
        return;
      }

      onAvatarUpdated(url);
      resetEditor();
      toast.success("תמונת הפרופיל עודכנה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-gaming-surface/50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar
            player={{ id: "me", name: displayName || "שחקן", avatarUrl }}
            size="lg"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">תמונת פרופיל</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              תמונת הפרופיל עשויה להופיע לחברי הקבוצה ובקישורי צפייה ציבוריים.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          <Camera className="h-4 w-4" />
          העלאה
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
        aria-label="בחר תמונת פרופיל"
      />

      {sourceUrl && (
        <div className="space-y-3">
          <div
            className="mx-auto h-56 w-56 touch-none overflow-hidden rounded-full border border-neon-green/60 bg-gaming-bg shadow-[0_0_22px_rgba(57,255,136,0.18)]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="img"
            aria-label="תצוגת חיתוך תמונת פרופיל"
          >
            <img
              src={sourceUrl}
              alt=""
              className="h-full w-full select-none object-cover"
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-muted-foreground">
              זום
            </label>
            <Slider
              min={1}
              max={2.4}
              step={0.02}
              value={[zoom]}
              onValueChange={([next]) => setZoom(next)}
              aria-label="זום תמונת פרופיל"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="gaming"
              onClick={saveAvatar}
              disabled={saving}
              className="h-11"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              שמור תמונה
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetEditor}
              disabled={saving}
              className="h-11"
            >
              <X className="h-4 w-4" />
              ביטול
            </Button>
          </div>
        </div>
      )}

      {!sourceUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-gaming-bg/40 text-sm font-semibold text-muted-foreground transition-colors hover:border-neon-green/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green"
        >
          <ImagePlus className="h-4 w-4" />
          בחר תמונה מהטלפון
        </button>
      )}
    </div>
  );
}
