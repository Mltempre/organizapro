import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1F4E5F, #0d3547)',
          borderRadius: 7,
          color: 'white',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        O
      </div>
    ),
    { width: 32, height: 32 }
  );
}
