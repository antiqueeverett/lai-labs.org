import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Solutions } from './pages/Solutions'
import { Industries } from './pages/Industries'
import { Impact } from './pages/Impact'
import { Partnerships } from './pages/Partnerships'
import { About } from './pages/About'
import { Contact } from './pages/Contact'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="solutions" element={<Solutions />} />
          <Route path="industries" element={<Industries />} />
          <Route path="impact" element={<Impact />} />
          <Route path="partnerships" element={<Partnerships />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
