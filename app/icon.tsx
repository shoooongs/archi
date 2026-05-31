import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#000',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 260,
        fontFamily: 'Georgia, serif',
        fontWeight: 400,
        letterSpacing: '-8px',
      }}
    >
      A
    </div>,
    { ...size },
  );
}
