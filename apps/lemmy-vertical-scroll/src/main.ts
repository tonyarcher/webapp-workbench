import './web-components/app-shell/app-shell'
import './styles/global.css'

const root = document.getElementById('app')
if (root) {
    root.appendChild(document.createElement('lvs-app-shell'))
}
