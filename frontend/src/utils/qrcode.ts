/**
 * QR Code Generator Utility
 * Generates QR codes locally as data URLs without external API calls.
 */
import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL (base64 PNG)
 * All generation happens locally — no data is sent to external services.
 */
export async function generateQRCodeDataUrl(
  content: string,
  size: number = 200,
  options: {
    errorCorrection?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
  } = {}
): Promise<string> {
  const {
    errorCorrection = 'M',
    margin = 1,
  } = options;

  return QRCode.toDataURL(content, {
    width: size,
    margin,
    errorCorrectionLevel: errorCorrection,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
