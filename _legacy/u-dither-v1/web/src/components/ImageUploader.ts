export function ImageUpload(onImage: (img: HTMLImageElement, file: File) => void) {
  const wrap = document.createElement("div");
  wrap.className = "uploadWrap";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.id = "fileInput";
  input.style.display = "none";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "uploadBtn";
  btn.textContent = "UPLOAD";

  const fileName = document.createElement("div");
  fileName.className = "fileName";
  fileName.textContent = "PNG, JPG, WEBP";

  wrap.appendChild(btn);
  wrap.appendChild(input);
  wrap.appendChild(fileName);

  btn.onclick = () => input.click();

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    fileName.textContent = file.name;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImage(img, file);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return wrap;
}
