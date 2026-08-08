# Linecraft 📈

**Linecraft** is an advanced, high-precision function visualizer and mathematical graphing application built for students, educators, and researchers. It provides interactive function plotting, calculus analysis, dynamic coordinate grids, and clean vector/image exports.

---

## ✨ Features

- **Interactive SVG Canvas**: Smooth panning, continuous vertical zoom scaling (0%–100%), axis toggles, and coordinate inspection.
- **Real-Time Function Plotting**: Plot multiple functions simultaneously with customizable color palettes, visibility toggles, and instant mathematical evaluation using MathJS.
- **Calculus & Numerical Analysis**:
  - **Tangent Lines**: Calculate exact slopes $f'(x)$ and plot tangent lines at any target point.
  - **Area Integration**: Shade and calculate definite integrals $\int_a^b f(x) dx$.
  - **Intersection & Point Pinning**: Locate curve intersections and pin specific coordinates directly on screen.
  - **Derivative Overlay**: Toggle $f'(x)$ overlays alongside primary function curves.
- **Dynamic Grid Styles**: Toggle between **Cartesian**, **Polar**, **Isometric**, and **Blank** coordinate grids.
- **Customizable Environment**:
  - **Day & Night Themes**: High-contrast dark and clean light mode modes.
  - **Trigonometric Units**: Switch seamlessly between **Radians** and **Degrees**.
  - **Decimal Precision**: Configurable precision from 1 to 4 decimal places.
- **Publication-Ready Exports**:
  - Export clean graphs to **PDF**, **PNG**, or **SVG** vector format.
  - Automatically suppresses toolbars, search bars, and floating controls during export.
- **Smart Input Helper**: Quick mathematical syntax snippets (`x²`, `√x`, `eˣ`, `|x|`, `π`, `sin(x)`) for effortless typing.

---

## 🛠️ Tech Stack

- **Frontend Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Graphing Engine**: [D3.js](https://d3js.org/) (Data-Driven Documents)
- **Math Engine**: [Math.js](https://mathjs.org/)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js (version 18 or higher) and npm installed:

```bash
node -v
npm -v
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/linecraft.git
   cd linecraft
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

---

## 📦 Scripts

- `npm run dev` – Starts the development server.
- `npm run build` – Builds the project for production.
- `npm run lint` – Runs TypeScript and code checks.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
