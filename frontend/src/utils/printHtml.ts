export function printHtmlDocument(html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Gagal membuka jendela cetak. Pastikan pop-up tidak diblokir oleh browser.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    try {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 100);
    } catch (err) {
      console.error('Gagal memanggil print:', err);
    }
  };
}
