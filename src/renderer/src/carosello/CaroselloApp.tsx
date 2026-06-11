import { Toolbar } from './components/Toolbar'
import { SlidesRail } from './components/SlidesRail'
import { Stage } from './components/Stage'
import { Inspector } from './components/Inspector'

/**
 * The Carosello editor — a Canva-style image+text editor for Instagram carousels.
 * Fully isolated from the video editor: its own store (useCarosello), its own
 * components, renderer-only import/export. Mounted by App.tsx when mode === 'carosello'.
 */
export default function CaroselloApp(): JSX.Element {
  return (
    <div className="car-app">
      <Toolbar />
      <div className="car-body">
        <SlidesRail />
        <Stage />
        <Inspector />
      </div>
    </div>
  )
}
