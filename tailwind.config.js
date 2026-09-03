import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

export default {
  content: [join(here, 'index.html'), join(here, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: { teal: '#0a9370', orange: '#f97316' },
      fontFamily: { sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
