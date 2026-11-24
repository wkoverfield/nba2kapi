import {
  Geist,
  Geist_Mono,
  Rajdhani,
  Bricolage_Grotesque,
  Instrument_Sans,
  IBM_Plex_Mono,
} from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Class names that define every font CSS variable. Goes on <body> in the
 * root layout and in global-error, which renders its own document.
 */
export const fontVariables = [
  geistSans,
  geistMono,
  rajdhani,
  bricolage,
  instrumentSans,
  plexMono,
]
  .map((font) => font.variable)
  .join(" ");
