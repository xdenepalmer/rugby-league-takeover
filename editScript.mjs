import fs from 'fs';

function replaceBlock(filePath, target, replacement) {
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes(target)) {
     console.error(`Target not found in ${filePath}:\n>>>${target}<<<`);
     return;
  }
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

// MediaAttach.jsx
replaceBlock('src/components/forum/MediaAttach.jsx',
`import { Input } from "@/components/ui/input";`,
`import { Input } from "@/components/ui/input";
import { useNativeCamera } from "@/hooks/useNativeCamera";`);

replaceBlock('src/components/forum/MediaAttach.jsx',
`  const [uploading, setUploading] = useState(false);
  const inputId = useId();`,
`  const [uploading, setUploading] = useState(false);
  const inputId = useId();
  const { pickMedia, isNative } = useNativeCamera();`);

replaceBlock('src/components/forum/MediaAttach.jsx',
`  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } finally {
      setUploading(false);
    }
  };`,
`  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } finally {
      setUploading(false);
    }
  };

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      const file = await pickMedia();
      if (file) upload(file);
    }
  };`);

replaceBlock('src/components/forum/MediaAttach.jsx',
`        <input id={inputId} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        <label htmlFor={inputId} className={\`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:border-primary hover:text-foreground \${uploading ? "pointer-events-none opacity-60" : ""}\`}>`,
`        {!isNative && (
          <input id={inputId} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        )}
        <label htmlFor={!isNative ? inputId : undefined} onClick={(e) => { if (isNative) handleNativeClick(e); }} className={\`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:border-primary hover:text-foreground \${uploading ? "pointer-events-none opacity-60" : ""}\`}>`);

// ImageField.jsx
replaceBlock('src/components/admin/ImageField.jsx',
`import { Input } from "@/components/ui/input";`,
`import { Input } from "@/components/ui/input";
import { useNativeCamera } from "@/hooks/useNativeCamera";`);

replaceBlock('src/components/admin/ImageField.jsx',
`  const [hovered, setHovered] = useState(false);
  const inputId = useId();
  const progressRef = useRef(null);`,
`  const [hovered, setHovered] = useState(false);
  const inputId = useId();
  const progressRef = useRef(null);
  const { pickMedia, isNative } = useNativeCamera();`);

replaceBlock('src/components/admin/ImageField.jsx',
`  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);`,
`  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      const file = await pickMedia();
      if (file) upload(file);
    }
  };`);

replaceBlock('src/components/admin/ImageField.jsx',
`              onClick={() => document.getElementById(inputId)?.click()}`,
`              onClick={(e) => {
                if (isNative) {
                  handleNativeClick(e);
                } else {
                  document.getElementById(inputId)?.click();
                }
              }}`);

replaceBlock('src/components/admin/ImageField.jsx',
`          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <label
            htmlFor={inputId}`,
`          {!isNative && (
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          )}
          <label
            htmlFor={!isNative ? inputId : undefined}
            onClick={(e) => { if (isNative) handleNativeClick(e); }}`);

// EventsManager.jsx
replaceBlock('src/components/admin/EventsManager.jsx',
`import AdminConfirmSheet from "./shared/AdminConfirmSheet";`,
`import AdminConfirmSheet from "./shared/AdminConfirmSheet";
import { useNativeCamera } from "@/hooks/useNativeCamera";`);

replaceBlock('src/components/admin/EventsManager.jsx',
`function PhotoUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);`,
`function PhotoUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { pickMedia, isNative } = useNativeCamera();`);

replaceBlock('src/components/admin/EventsManager.jsx',
`      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
    } finally {
      setUploading(false);
    }
  };`,
`      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
    } finally {
      setUploading(false);
    }
  };

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      const file = await pickMedia();
      if (file) upload(file);
    }
  };`);

replaceBlock('src/components/admin/EventsManager.jsx',
`      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
    >`,
`      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
      onClick={(e) => { if (isNative) handleNativeClick(e); }}
    >`);

replaceBlock('src/components/admin/EventsManager.jsx',
`      <input type="file" accept="image/*" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} className="absolute inset-0 opacity-0 cursor-pointer" />`,
`      {!isNative ? (
        <input type="file" accept="image/*" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      ) : (
        <div className="absolute inset-0 cursor-pointer" />
      )}`);

// MediaUploader.jsx
replaceBlock('src/components/admin/MediaUploader.jsx',
`import { motion, AnimatePresence } from "framer-motion";`,
`import { motion, AnimatePresence } from "framer-motion";
import { useNativeCamera } from "@/hooks/useNativeCamera";`);

replaceBlock('src/components/admin/MediaUploader.jsx',
`  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);
  const FileIcon = getFileIcon(accept);`,
`  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);
  const FileIcon = getFileIcon(accept);
  const { pickMedia, isNative } = useNativeCamera();`);

replaceBlock('src/components/admin/MediaUploader.jsx',
`  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);`,
`  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      const file = await pickMedia({ accept });
      if (file) upload(file);
    }
  };`);

replaceBlock('src/components/admin/MediaUploader.jsx',
`        onClick={() => !uploading && inputRef.current?.click()}`,
`        onClick={(e) => {
          if (uploading) return;
          if (isNative) {
            handleNativeClick(e);
          } else {
            inputRef.current?.click();
          }
        }}`);

replaceBlock('src/components/admin/MediaUploader.jsx',
`        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => upload(e.target.files?.[0])}
          className="hidden"
        />`,
`        {!isNative && (
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(e) => upload(e.target.files?.[0])}
            className="hidden"
          />
        )}`);
