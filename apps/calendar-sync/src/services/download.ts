export function downloadText(filename: string, text: string, mime: string): void {
    const blob = new Blob([text], {type: mime});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
