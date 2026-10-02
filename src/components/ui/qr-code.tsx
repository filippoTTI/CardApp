import QRCodeSvg from 'react-native-qrcode-svg';

type Props = {
  /** Testo da codificare. */
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

/** Genera e disegna un QR code (vettoriale, nitido a qualsiasi dimensione). */
export function QrCode({ value, size = 160, color = '#000000', backgroundColor = '#FFFFFF' }: Props) {
  return <QRCodeSvg value={value} size={size} color={color} backgroundColor={backgroundColor} ecl="M" quietZone={0} />;
}
