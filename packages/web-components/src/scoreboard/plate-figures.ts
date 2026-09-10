import {svg} from 'lit';

/**
 * Hand-authored neon athletes for the plate scene.
 * Limbs are drawn twice: a wide translucent "tube" plus a thin bright core.
 * That reads as volume; single hairlines read as stick figures.
 */

/* Pitcher: front view, mid-windup. 60 x 84 units. LHP arms swap via CSS. */
export function pitcherFigure() {
    return svg`
        <g class="figure pitcher-figure">
            ${pitcherLegs()}
            <g class="upper" transform="rotate(-6 30 51)">
                ${pitcherHead()}
                ${pitcherTorso()}
                ${pitcherGloveArms()}
                ${pitcherPitchArms()}
            </g>
        </g>
    `;
}

function pitcherHead() {
    return svg`
        <g class="head">
            <path class="solid" d="M24 10 Q24 3.6 30 3.6 Q36 3.6 36 10 Q36 15.8 30 16.4 Q24 15.8 24 10 Z"/>
            <path class="cap" d="M23.2 9.6 Q23.2 2.6 30 2.6 Q36.8 2.6 36.8 9.6 Q33.4 7.8 30 7.8 Q26.6 7.8 23.2 9.6 Z"/>
            <path class="cap" d="M22.4 8.6 Q30 12.6 37.6 8.6 Q37 11.4 30 12.4 Q23 11.4 22.4 8.6 Z"/>
        </g>
    `;
}

function pitcherTorso() {
    return svg`
        <g class="torso">
            <path class="solid" d="M19.4 24 Q22 18.6 30 18.6 Q38 18.6 40.6 24 Q42.4 32 40.8 40 Q39.4 46 39.4 51 L20.6 51 Q20.6 46 19.2 40 Q17.6 32 19.4 24 Z"/>
            <path class="detail" d="M25.4 19.4 Q30 23.4 34.6 19.4"/>
            <path class="detail" d="M30 23.6 V50"/>
            <path class="detail" d="M20.8 46.8 H39.2"/>
            <text class="jersey-num" x="30" y="41" text-anchor="middle">32</text>
        </g>
    `;
}

function pitcherLegs() {
    return svg`
        <g class="legs">
            <path class="tube" d="M22.4 50 C19.4 60 16.8 69 15 78"/>
            <path class="core" d="M22.4 50 C19.4 60 16.8 69 15 78"/>
            <path class="tube" d="M37.6 50 C40.6 60 43.2 69 45 78"/>
            <path class="core" d="M37.6 50 C40.6 60 43.2 69 45 78"/>
            <path class="solid" d="M10.6 77.4 Q14.6 74.8 19.4 77.6 L19 82.6 H10.4 Z"/>
            <path class="solid" d="M40.6 77.6 Q45.4 74.8 49.4 77.4 L49.6 82.6 H41 Z"/>
        </g>
    `;
}

function pitcherGloveArms() {
    return svg`
        <g class="arm glove-arm side-right">${gloveArm()}</g>
        <g class="arm glove-arm side-left" transform="matrix(-1 0 0 1 60 0)">${gloveArm()}</g>
    `;
}

function pitcherPitchArms() {
    return svg`
        <g class="arm pitch-arm side-left">${pitchArm()}</g>
        <g class="arm pitch-arm side-right" transform="matrix(-1 0 0 1 60 0)">${pitchArm()}</g>
    `;
}

function gloveArm() {
    return svg`
        <path class="tube" d="M39.6 24.6 C45 27 48.4 32 49.4 37"/>
        <path class="core" d="M39.6 24.6 C45 27 48.4 32 49.4 37"/>
        <path class="leather" d="M45.6 35.4 Q49.6 32.4 53.6 34.4 Q57.6 36.6 57.6 40.6 Q57.6 44.6 53.6 46.2 Q49.2 47.8 46.4 44.8 Q43.8 41 45.6 35.4 Z"/>
        <path class="leather" d="M45.2 37.6 Q44 35.6 45.6 34.2 Q47.6 33.2 48.8 35.2 Z"/>
        <path class="detail" d="M48.4 36.2 L53 41.2 M50.6 34.8 L55 39.4 M47.2 39.8 L51.2 44"/>
    `;
}

function pitchArm() {
    return svg`
        <g class="pitch-swing">
            <path class="tube" d="M20.4 24 C14 22.6 9.6 17.4 8.4 10.4"/>
            <path class="core" d="M20.4 24 C14 22.6 9.6 17.4 8.4 10.4"/>
            <circle class="solid" cx="8.4" cy="9.6" r="3.2"/>
            <g class="hand-ball">
                <circle class="ball" cx="7.6" cy="7.2" r="2.7"/>
                <path class="stitch" d="M5.8 6 Q7.6 8 9.4 6"/>
            </g>
        </g>
    `;
}

/* Batter: side view facing the plate. 84 x 132 units. LHB mirrors via CSS. */
export function batterFigure() {
    return svg`
        <g class="figure batter-figure">
            ${batterLegs()}
            <g class="swing-upper">
                ${batterTorso()}
                <path class="swing-arc" d="M13.3 10.4 Q72 -14 115 76"/>
                <g class="swing-group">
                    ${batterBat()}
                    ${batterArm()}
                </g>
                ${batterHead()}
            </g>
        </g>
    `;
}

function batterLegs() {
    return svg`
        <g class="legs">
            <path class="tube" d="M40 84 C35 96 32.4 108 31 121"/>
            <path class="core" d="M40 84 C35 96 32.4 108 31 121"/>
            <path class="tube" d="M49 86 C55 98 57.6 108 59 121"/>
            <path class="core" d="M49 86 C55 98 57.6 108 59 121"/>
            <path class="solid" d="M27.4 120.4 Q32.4 118.4 35.4 121.6 L37.4 126.4 Q31.4 129.4 26.6 126.4 Z"/>
            <path class="solid" d="M55.4 120.4 Q60.4 118.4 63.4 121.6 L66 126.4 Q60 129.4 55 126.4 Z"/>
        </g>
    `;
}

function batterTorso() {
    return svg`
        <g class="torso">
            <path class="solid" d="M39 86 C36.4 74 38.6 60 44 48 Q50.4 43.4 56.6 49.4 C55.6 62 52.6 76 50.4 88 Q44.6 90.4 39 86 Z"/>
            <path class="detail" d="M44 48.6 Q48.4 52 53.4 49.4"/>
            <path class="detail" d="M38.6 84.6 Q45 87 50.8 86.4"/>
            <text class="jersey-num" x="46" y="72" text-anchor="middle">7</text>
        </g>
    `;
}

function batterHead() {
    return svg`
        <g class="head">
            <path class="solid" d="M53 40 C50.8 41.8 48.8 43.2 47.6 44.2 Q50.4 44.8 54.4 44.4 C56.2 43.2 57.4 41.8 56.8 40.6 Q55 40 53 40 Z"/>
            <path class="solid" d="M50.6 33.4 Q50.6 24 58 24 Q65.4 24 65.4 33.4 Q65.4 39.4 58 40 Q50.6 39.4 50.6 33.4 Z"/>
            <path class="cap" d="M49.4 32.6 Q49.4 22.6 58 22.6 Q66.6 22.6 66.6 32.6 Q62.6 29.6 58 29.6 Q53.4 29.6 49.4 32.6 Z"/>
            <path class="cap" d="M64.6 30.6 Q70 31.6 70.4 35 Q65.6 36.4 63.2 33.6 Z"/>
        </g>
    `;
}

function batterArm() {
    return svg`
        <g class="arm lead-arm">
            <path class="tube" d="M50 58 C53.6 60 56.2 55.4 54.4 47.8"/>
            <path class="core" d="M50 58 C53.6 60 56.2 55.4 54.4 47.8"/>
            <path class="tube" d="M40 58 C38.6 51.6 45 47.6 52.6 51"/>
            <path class="core" d="M40 58 C38.6 51.6 45 47.6 52.6 51"/>
            <circle class="solid" cx="52.6" cy="49.6" r="2.4"/>
            <circle class="solid" cx="54.4" cy="47.8" r="2.2"/>
        </g>
    `;
}

function batterBat() {
    return svg`
        <g class="bat">
            <path class="wood" d="M55.5 48.7 L18.7 5.6 L13.3 10.4 L52.5 51.3 Z"/>
            <path class="tape" d="M55.5 48.7 L42.2 34 L39.2 36.6 L52.5 51.3 Z"/>
            <path class="detail" d="M52 46.6 L20.6 11.6"/>
            <circle class="solid" cx="54.6" cy="50.4" r="2.8"/>
        </g>
    `;
}
