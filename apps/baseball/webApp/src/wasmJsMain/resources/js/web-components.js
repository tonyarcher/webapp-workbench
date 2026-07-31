(function(){"use strict";/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var xt;const G=globalThis,et=G.ShadowRoot&&(G.ShadyCSS===void 0||G.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,pt=Symbol(),ut=new WeakMap;let Ct=class{constructor(t,e,r){if(this._$cssResult$=!0,r!==pt)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(et&&t===void 0){const r=e!==void 0&&e.length===1;r&&(t=ut.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),r&&ut.set(e,t))}return t}toString(){return this.cssText}};const Tt=i=>new Ct(typeof i=="string"?i:i+"",void 0,pt),Rt=(i,t)=>{if(et)i.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const r=document.createElement("style"),s=G.litNonce;s!==void 0&&r.setAttribute("nonce",s),r.textContent=e.cssText,i.appendChild(r)}},mt=et?i=>i:i=>i instanceof CSSStyleSheet?(t=>{let e="";for(const r of t.cssRules)e+=r.cssText;return Tt(e)})(i):i;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Ht,defineProperty:Bt,getOwnPropertyDescriptor:Ut,getOwnPropertyNames:Dt,getOwnPropertySymbols:jt,getPrototypeOf:Mt}=Object,g=globalThis,bt=g.trustedTypes,Lt=bt?bt.emptyScript:"",st=g.reactiveElementPolyfillSupport,U=(i,t)=>i,V={toAttribute(i,t){switch(t){case Boolean:i=i?Lt:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,t){let e=i;switch(t){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},rt=(i,t)=>!Ht(i,t),$t={attribute:!0,type:String,converter:V,reflect:!1,useDefault:!1,hasChanged:rt};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),g.litPropertyMetadata??(g.litPropertyMetadata=new WeakMap);let T=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$t){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const r=Symbol(),s=this.getPropertyDescriptor(t,r,e);s!==void 0&&Bt(this.prototype,t,s)}}static getPropertyDescriptor(t,e,r){const{get:s,set:n}=Ut(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:s,set(o){const h=s==null?void 0:s.call(this);n==null||n.call(this,o),this.requestUpdate(t,h,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$t}static _$Ei(){if(this.hasOwnProperty(U("elementProperties")))return;const t=Mt(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(U("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(U("properties"))){const e=this.properties,r=[...Dt(e),...jt(e)];for(const s of r)this.createProperty(s,e[s])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[r,s]of e)this.elementProperties.set(r,s)}this._$Eh=new Map;for(const[e,r]of this.elementProperties){const s=this._$Eu(e,r);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const r=new Set(t.flat(1/0).reverse());for(const s of r)e.unshift(mt(s))}else t!==void 0&&e.push(mt(t));return e}static _$Eu(t,e){const r=e.attribute;return r===!1?void 0:typeof r=="string"?r:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const r of e.keys())this.hasOwnProperty(r)&&(t.set(r,this[r]),delete this[r]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Rt(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var r;return(r=e.hostConnected)==null?void 0:r.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var r;return(r=e.hostDisconnected)==null?void 0:r.call(e)})}attributeChangedCallback(t,e,r){this._$AK(t,r)}_$ET(t,e){var n;const r=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,r);if(s!==void 0&&r.reflect===!0){const o=(((n=r.converter)==null?void 0:n.toAttribute)!==void 0?r.converter:V).toAttribute(e,r.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){var n,o;const r=this.constructor,s=r._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const h=r.getPropertyOptions(s),l=typeof h.converter=="function"?{fromAttribute:h.converter}:((n=h.converter)==null?void 0:n.fromAttribute)!==void 0?h.converter:V;this._$Em=s;const u=l.fromAttribute(e,h.type);this[s]=u??((o=this._$Ej)==null?void 0:o.get(s))??u,this._$Em=null}}requestUpdate(t,e,r,s=!1,n){var o;if(t!==void 0){const h=this.constructor;if(s===!1&&(n=this[t]),r??(r=h.getPropertyOptions(t)),!((r.hasChanged??rt)(n,e)||r.useDefault&&r.reflect&&n===((o=this._$Ej)==null?void 0:o.get(t))&&!this.hasAttribute(h._$Eu(t,r))))return;this.C(t,e,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:r,reflect:s,wrapped:n},o){r&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||r||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var r;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,o]of this._$Ep)this[n]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[n,o]of s){const{wrapped:h}=o,l=this[n];h!==!0||this._$AL.has(n)||l===void 0||this.C(n,void 0,o,l)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(r=this._$EO)==null||r.forEach(s=>{var n;return(n=s.hostUpdate)==null?void 0:n.call(s)}),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(r=>{var s;return(s=r.hostUpdated)==null?void 0:s.call(r)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};T.elementStyles=[],T.shadowRootOptions={mode:"open"},T[U("elementProperties")]=new Map,T[U("finalized")]=new Map,st==null||st({ReactiveElement:T}),(g.reactiveElementVersions??(g.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const D=globalThis,yt=i=>i,q=D.trustedTypes,vt=q?q.createPolicy("lit-html",{createHTML:i=>i}):void 0,ft="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,gt="?"+_,It=`<${gt}>`,w=document,j=()=>w.createComment(""),M=i=>i===null||typeof i!="object"&&typeof i!="function",it=Array.isArray,Ft=i=>it(i)||typeof(i==null?void 0:i[Symbol.iterator])=="function",nt=`[ 	
\f\r]`,L=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,_t=/-->/g,St=/>/g,P=RegExp(`>|${nt}(?:([^\\s"'>=/]+)(${nt}*=${nt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),At=/'/g,Et=/"/g,wt=/^(?:script|style|textarea|title)$/i,Jt=i=>(t,...e)=>({_$litType$:i,strings:t,values:e}),c=Jt(1),R=Symbol.for("lit-noChange"),b=Symbol.for("lit-nothing"),Pt=new WeakMap,N=w.createTreeWalker(w,129);function Nt(i,t){if(!it(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return vt!==void 0?vt.createHTML(t):t}const zt=(i,t)=>{const e=i.length-1,r=[];let s,n=t===2?"<svg>":t===3?"<math>":"",o=L;for(let h=0;h<e;h++){const l=i[h];let u,$,d=-1,f=0;for(;f<l.length&&(o.lastIndex=f,$=o.exec(l),$!==null);)f=o.lastIndex,o===L?$[1]==="!--"?o=_t:$[1]!==void 0?o=St:$[2]!==void 0?(wt.test($[2])&&(s=RegExp("</"+$[2],"g")),o=P):$[3]!==void 0&&(o=P):o===P?$[0]===">"?(o=s??L,d=-1):$[1]===void 0?d=-2:(d=o.lastIndex-$[2].length,u=$[1],o=$[3]===void 0?P:$[3]==='"'?Et:At):o===Et||o===At?o=P:o===_t||o===St?o=L:(o=P,s=void 0);const E=o===P&&i[h+1].startsWith("/>")?" ":"";n+=o===L?l+It:d>=0?(r.push(u),l.slice(0,d)+ft+l.slice(d)+_+E):l+_+(d===-2?h:E)}return[Nt(i,n+(i[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),r]};class I{constructor({strings:t,_$litType$:e},r){let s;this.parts=[];let n=0,o=0;const h=t.length-1,l=this.parts,[u,$]=zt(t,e);if(this.el=I.createElement(u,r),N.currentNode=this.el.content,e===2||e===3){const d=this.el.content.firstChild;d.replaceWith(...d.childNodes)}for(;(s=N.nextNode())!==null&&l.length<h;){if(s.nodeType===1){if(s.hasAttributes())for(const d of s.getAttributeNames())if(d.endsWith(ft)){const f=$[o++],E=s.getAttribute(d).split(_),tt=/([.?@])?(.*)/.exec(f);l.push({type:1,index:n,name:tt[2],strings:E,ctor:tt[1]==="."?Gt:tt[1]==="?"?Vt:tt[1]==="@"?qt:K}),s.removeAttribute(d)}else d.startsWith(_)&&(l.push({type:6,index:n}),s.removeAttribute(d));if(wt.test(s.tagName)){const d=s.textContent.split(_),f=d.length-1;if(f>0){s.textContent=q?q.emptyScript:"";for(let E=0;E<f;E++)s.append(d[E],j()),N.nextNode(),l.push({type:2,index:++n});s.append(d[f],j())}}}else if(s.nodeType===8)if(s.data===gt)l.push({type:2,index:n});else{let d=-1;for(;(d=s.data.indexOf(_,d+1))!==-1;)l.push({type:7,index:n}),d+=_.length-1}n++}}static createElement(t,e){const r=w.createElement("template");return r.innerHTML=t,r}}function H(i,t,e=i,r){var o,h;if(t===R)return t;let s=r!==void 0?(o=e._$Co)==null?void 0:o[r]:e._$Cl;const n=M(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==n&&((h=s==null?void 0:s._$AO)==null||h.call(s,!1),n===void 0?s=void 0:(s=new n(i),s._$AT(i,e,r)),r!==void 0?(e._$Co??(e._$Co=[]))[r]=s:e._$Cl=s),s!==void 0&&(t=H(i,s._$AS(i,t.values),s,r)),t}class Wt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:r}=this._$AD,s=((t==null?void 0:t.creationScope)??w).importNode(e,!0);N.currentNode=s;let n=N.nextNode(),o=0,h=0,l=r[0];for(;l!==void 0;){if(o===l.index){let u;l.type===2?u=new F(n,n.nextSibling,this,t):l.type===1?u=new l.ctor(n,l.name,l.strings,this,t):l.type===6&&(u=new Kt(n,this,t)),this._$AV.push(u),l=r[++h]}o!==(l==null?void 0:l.index)&&(n=N.nextNode(),o++)}return N.currentNode=w,s}p(t){let e=0;for(const r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(t,r,e),e+=r.strings.length-2):r._$AI(t[e])),e++}}class F{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,r,s){this.type=2,this._$AH=b,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=r,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=H(this,t,e),M(t)?t===b||t==null||t===""?(this._$AH!==b&&this._$AR(),this._$AH=b):t!==this._$AH&&t!==R&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Ft(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==b&&M(this._$AH)?this._$AA.nextSibling.data=t:this.T(w.createTextNode(t)),this._$AH=t}$(t){var n;const{values:e,_$litType$:r}=t,s=typeof r=="number"?this._$AC(t):(r.el===void 0&&(r.el=I.createElement(Nt(r.h,r.h[0]),this.options)),r);if(((n=this._$AH)==null?void 0:n._$AD)===s)this._$AH.p(e);else{const o=new Wt(s,this),h=o.u(this.options);o.p(e),this.T(h),this._$AH=o}}_$AC(t){let e=Pt.get(t.strings);return e===void 0&&Pt.set(t.strings,e=new I(t)),e}k(t){it(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let r,s=0;for(const n of t)s===e.length?e.push(r=new F(this.O(j()),this.O(j()),this,this.options)):r=e[s],r._$AI(n),s++;s<e.length&&(this._$AR(r&&r._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){var r;for((r=this._$AP)==null?void 0:r.call(this,!1,!0,e);t!==this._$AB;){const s=yt(t).nextSibling;yt(t).remove(),t=s}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class K{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,r,s,n){this.type=1,this._$AH=b,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=b}_$AI(t,e=this,r,s){const n=this.strings;let o=!1;if(n===void 0)t=H(this,t,e,0),o=!M(t)||t!==this._$AH&&t!==R,o&&(this._$AH=t);else{const h=t;let l,u;for(t=n[0],l=0;l<n.length-1;l++)u=H(this,h[r+l],e,l),u===R&&(u=this._$AH[l]),o||(o=!M(u)||u!==this._$AH[l]),u===b?t=b:t!==b&&(t+=(u??"")+n[l+1]),this._$AH[l]=u}o&&!s&&this.j(t)}j(t){t===b?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Gt extends K{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===b?void 0:t}}class Vt extends K{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==b)}}class qt extends K{constructor(t,e,r,s,n){super(t,e,r,s,n),this.type=5}_$AI(t,e=this){if((t=H(this,t,e,0)??b)===R)return;const r=this._$AH,s=t===b&&r!==b||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,n=t!==b&&(r===b||s);s&&this.element.removeEventListener(this.name,this,r),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class Kt{constructor(t,e,r){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(t){H(this,t)}}const ot=D.litHtmlPolyfillSupport;ot==null||ot(I,F),(D.litHtmlVersions??(D.litHtmlVersions=[])).push("3.3.3");const Zt=(i,t,e)=>{const r=(e==null?void 0:e.renderBefore)??t;let s=r._$litPart$;if(s===void 0){const n=(e==null?void 0:e.renderBefore)??null;r._$litPart$=s=new F(t.insertBefore(j(),n),n,void 0,e??{})}return s._$AI(i),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const O=globalThis;class y extends T{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Zt(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return R}}y._$litElement$=!0,y.finalized=!0,(xt=O.litElementHydrateSupport)==null||xt.call(O,{LitElement:y});const at=O.litElementPolyfillSupport;at==null||at({LitElement:y}),(O.litElementVersions??(O.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const v=i=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,t)}):customElements.define(i,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Yt={attribute:!0,type:String,converter:V,reflect:!1,hasChanged:rt},Qt=(i=Yt,t,e)=>{const{kind:r,metadata:s}=e;let n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),r==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(e.name,i),r==="accessor"){const{name:o}=e;return{set(h){const l=t.get.call(this);t.set.call(this,h),this.requestUpdate(o,l,i,!0,h)},init(h){return h!==void 0&&this.C(o,void 0,i,h),h}}}if(r==="setter"){const{name:o}=e;return function(h){const l=this[o];t.call(this,h),this.requestUpdate(o,l,i,!0,h)}}throw Error("Unsupported decorator location: "+r)};function a(i){return(t,e)=>typeof e=="object"?Qt(i,t,e):((r,s,n)=>{const o=s.hasOwnProperty(n);return s.constructor.createProperty(n,r),o?Object.getOwnPropertyDescriptor(s,n):void 0})(i,t,e)}var Xt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,m=(i,t,e,r)=>{for(var s=r>1?void 0:r?kt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&Xt(t,e,s),s};let p=class extends y{constructor(){super(...arguments),this.awayName="AWAY",this.homeName="HOME",this.awayScore=0,this.homeScore=0,this.awayHits=0,this.homeHits=0,this.awayErrors=0,this.homeErrors=0,this.inning=1,this.half="TOP",this.balls=0,this.strikes=0,this.outs=0,this.runnerFirst=!1,this.runnerSecond=!1,this.runnerThird=!1,this.runnerFirstName="",this.runnerSecondName="",this.runnerThirdName=""}createRenderRoot(){return this}render(){const i=this.half==="TOP"?"▲":"▼",t=this.outs===0?"No Outs":this.outs===1?"1 Out":this.outs===2?"2 Outs":"3 Outs";return c`
      <div class="scoreboard-led">
        <div class="scoreboard-header">
          <span class="inning-display">${i} Inning ${this.inning}</span>
          <span class="outs-indicator">${t}</span>
        </div>

        <div class="scoreboard-row">
          <span class="team-led-name">${this.awayName}</span>
          <span class="team-led-score">${this.awayScore}</span>
        </div>

        <div class="scoreboard-row">
          <span class="team-led-name">${this.homeName}</span>
          <span class="team-led-score">${this.homeScore}</span>
        </div>

        <div class="scoreboard-row margin-top-md">
          <span class="count-display">Count: ${this.balls} - ${this.strikes}</span>
          <span class="text-muted font-small">
            R-H-E: ${this.awayScore}-${this.awayHits}-${this.awayErrors} vs ${this.homeScore}-${this.homeHits}-${this.homeErrors}
          </span>
        </div>

        <div class="diamond-container">
          <div class="base-diamond">
            <div class="base base-first ${this.runnerFirst?"occupied":""}">
              <div class="base-label">1st</div>
            </div>
            <div class="base base-second ${this.runnerSecond?"occupied":""}">
              <div class="base-label">2nd</div>
            </div>
            <div class="base base-third ${this.runnerThird?"occupied":""}">
              <div class="base-label">3rd</div>
            </div>
            <div class="base base-home"></div>
          </div>
        </div>

        <div class="text-muted font-small margin-top-md border-top-dark padding-top-sm">
          ${this.runnerFirstName?c`<div>1B: ${this.runnerFirstName}</div>`:""}
          ${this.runnerSecondName?c`<div>2B: ${this.runnerSecondName}</div>`:""}
          ${this.runnerThirdName?c`<div>3B: ${this.runnerThirdName}</div>`:""}
        </div>
      </div>
    `}};m([a({type:String,attribute:"away-name"})],p.prototype,"awayName",2),m([a({type:String,attribute:"home-name"})],p.prototype,"homeName",2),m([a({type:Number,attribute:"away-score"})],p.prototype,"awayScore",2),m([a({type:Number,attribute:"home-score"})],p.prototype,"homeScore",2),m([a({type:Number,attribute:"away-hits"})],p.prototype,"awayHits",2),m([a({type:Number,attribute:"home-hits"})],p.prototype,"homeHits",2),m([a({type:Number,attribute:"away-errors"})],p.prototype,"awayErrors",2),m([a({type:Number,attribute:"home-errors"})],p.prototype,"homeErrors",2),m([a({type:Number})],p.prototype,"inning",2),m([a({type:String})],p.prototype,"half",2),m([a({type:Number})],p.prototype,"balls",2),m([a({type:Number})],p.prototype,"strikes",2),m([a({type:Number})],p.prototype,"outs",2),m([a({type:Boolean,attribute:"runner-first"})],p.prototype,"runnerFirst",2),m([a({type:Boolean,attribute:"runner-second"})],p.prototype,"runnerSecond",2),m([a({type:Boolean,attribute:"runner-third"})],p.prototype,"runnerThird",2),m([a({type:String,attribute:"runner-first-name"})],p.prototype,"runnerFirstName",2),m([a({type:String,attribute:"runner-second-name"})],p.prototype,"runnerSecondName",2),m([a({type:String,attribute:"runner-third-name"})],p.prototype,"runnerThirdName",2),p=m([v("baseball-scoreboard")],p);var te=Object.defineProperty,ee=Object.getOwnPropertyDescriptor,lt=(i,t,e,r)=>{for(var s=r>1?void 0:r?ee(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&te(t,e,s),s};let Z=class extends y{constructor(){super(...arguments),this.fielders=[]}createRenderRoot(){return this}set fieldersJson(i){this.fielders=i}render(){return c`
      <div class="field-diagram-card card">
        <h3>DEFENSIVE POSITIONS</h3>
        <div class="field-diagram-wrapper">
          <div id="field-diamond-bg"></div>
          ${["P","C","1B","2B","3B","SS","LF","CF","RF"].map(t=>{const e=this.fielders.find(s=>s.position===t),r=e?e.name:t;return c`
              <div class="field-position-badge pos-pos-${t}">
                <span class="font-bold">${t}: ${r}</span>
              </div>
            `})}
        </div>
      </div>
    `}};lt([a({type:Array})],Z.prototype,"fielders",2),lt([a({type:String,attribute:"fielders-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],Z.prototype,"fieldersJson",1),Z=lt([v("baseball-defense-diagram")],Z);var se=Object.defineProperty,re=Object.getOwnPropertyDescriptor,x=(i,t,e,r)=>{for(var s=r>1?void 0:r?re(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&se(t,e,s),s};let S=class extends y{constructor(){super(...arguments),this.teamName="TEAM",this.batters=[],this.lineScore=[0,0,0,0,0,0,0,0,0],this.totalRuns=0,this.totalHits=0,this.totalErrors=0}createRenderRoot(){return this}render(){const i=[1,2,3,4,5,6,7,8,9];return c`
      <div class="card scorebook-grid-card">
        <div class="flex-between margin-bottom-sm">
          <h3 class="text-accent-green font-bold">${this.teamName} LINEUP & SCOREBOOK</h3>
          <div class="text-muted font-small">R: ${this.totalRuns} | H: ${this.totalHits} | E: ${this.totalErrors}</div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>BATTER</th>
                <th>POS</th>
                ${i.map(t=>c`<th>${t}</th>`)}
                <th>AB</th>
                <th>R</th>
                <th>H</th>
              </tr>
            </thead>
            <tbody>
              ${this.batters.map(t=>c`
                  <tr>
                    <td class="font-bold text-muted">${t.slot}</td>
                    <td class="font-bold">${t.batterName}</td>
                    <td class="text-secondary">${t.position}</td>
                    ${(t.innings||[]).map(e=>c`<td class="scorebook-cell ${e?"occupied-cell":""}">${e||""}</td>`)}
                    <td>${t.runs+t.hits}</td>
                    <td class="font-bold text-accent-yellow">${t.runs}</td>
                    <td class="font-bold">${t.hits}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `}};x([a({type:String,attribute:"team-name"})],S.prototype,"teamName",2),x([a({type:Array})],S.prototype,"batters",2),x([a({type:Array})],S.prototype,"lineScore",2),x([a({type:Number,attribute:"total-runs"})],S.prototype,"totalRuns",2),x([a({type:Number,attribute:"total-hits"})],S.prototype,"totalHits",2),x([a({type:Number,attribute:"total-errors"})],S.prototype,"totalErrors",2),S=x([v("baseball-scorebook-grid")],S);var ie=Object.defineProperty,ne=Object.getOwnPropertyDescriptor,J=(i,t,e,r)=>{for(var s=r>1?void 0:r?ne(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&ie(t,e,s),s};let B=class extends y{constructor(){super(...arguments),this.batterName="None",this.batterStats="",this.pitcherName="None",this.pitcherStats=""}createRenderRoot(){return this}render(){return c`
      <div class="matchup-container card">
        <div class="flex-between text-center">
          <div class="flex-grow">
            <div class="text-accent-green font-bold">CURRENT BATTER</div>
            <div class="matchup-player-name">${this.batterName}</div>
            <div class="matchup-player-stats">${this.batterStats}</div>
          </div>

          <div class="text-accent-yellow font-bold margin-left-right-md" style="margin: 0 1rem;">
            VS
          </div>

          <div class="flex-grow">
            <div class="text-accent-green font-bold">CURRENT PITCHER</div>
            <div class="matchup-player-name">${this.pitcherName}</div>
            <div class="matchup-player-stats">${this.pitcherStats}</div>
          </div>
        </div>
      </div>
    `}};J([a({type:String,attribute:"batter-name"})],B.prototype,"batterName",2),J([a({type:String,attribute:"batter-stats"})],B.prototype,"batterStats",2),J([a({type:String,attribute:"pitcher-name"})],B.prototype,"pitcherName",2),J([a({type:String,attribute:"pitcher-stats"})],B.prototype,"pitcherStats",2),B=J([v("baseball-matchup-card")],B);var oe=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,Ot=(i,t,e,r)=>{for(var s=r>1?void 0:r?ae(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&oe(t,e,s),s};let ht=class extends y{constructor(){super(...arguments),this.currentPitchType=null}createRenderRoot(){return this}selectPitchType(i){const t=this.currentPitchType===i?"":i;this.setAttribute("selected-pitch-type",t),this.dispatchEvent(new Event("pitch-type-selected",{bubbles:!0}))}triggerEvent(i){this.setAttribute("triggered-event-type",i),this.dispatchEvent(new Event("action-triggered",{bubbles:!0}))}triggerStep2(i,t){this.setAttribute("step2-event-type",i),this.setAttribute("step2-label",t),this.dispatchEvent(new Event("step2-requested",{bubbles:!0}))}render(){return c`
      <div class="flex-gap-sm margin-bottom-md">
        ${["Fastball","Breaking Ball","Offspeed"].map(t=>{const e=t===this.currentPitchType;return c`
            <button
              class="btn ${e?"btn-primary":"btn-secondary"} flex-grow"
              @click=${()=>this.selectPitchType(t)}
            >
              ${t}
            </button>
          `})}
      </div>

      <div class="text-accent-green font-bold margin-bottom-sm">PITCH RESULTS</div>
      <div class="action-grid-3col">
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerEvent("BALL")}>Ball (B+1)</button>
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerEvent("STRIKE")}>Strike (S+1)</button>
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerEvent("FOUL")}>Foul</button>
      </div>

      <div class="text-accent-green font-bold margin-top-md margin-bottom-sm">BASE RUNNING EVENTS</div>
      <div class="action-grid-2col">
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerStep2("STOLEN_BASE","Stolen Base")}>
          Stolen Base
        </button>
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerStep2("CAUGHT_STEALING","Caught Stealing")}>
          Caught Stealing
        </button>
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerStep2("PICKED_OFF","Picked Off")}>
          Picked Off
        </button>
        <button class="btn btn-secondary btn-action" @click=${()=>this.triggerStep2("WILD_PITCH","WP / PB / Balk")}>
          WP / PB / Balk
        </button>
      </div>
    `}};Ot([a({type:String,attribute:"current-pitch-type"})],ht.prototype,"currentPitchType",2),ht=Ot([v("baseball-action-grid")],ht);var le=Object.defineProperty,he=Object.getOwnPropertyDescriptor,ct=(i,t,e,r)=>{for(var s=r>1?void 0:r?he(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&le(t,e,s),s};let Y=class extends y{constructor(){super(...arguments),this.standings=[]}createRenderRoot(){return this}set standingsJson(i){this.standings=i}formatPct(i){return(i||0).toFixed(3).replace(/^0+/,"")}render(){return c`
      <div class="card">
        <h2>League Standings</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>GP</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>RS</th>
                <th>RA</th>
              </tr>
            </thead>
            <tbody>
              ${this.standings.map(i=>c`
                  <tr>
                    <td class="font-bold">${i.teamName}</td>
                    <td>${i.gamesPlayed}</td>
                    <td>${i.wins}</td>
                    <td>${i.losses}</td>
                    <td>${this.formatPct(i.winPercentage)}</td>
                    <td>${i.runsScored}</td>
                    <td>${i.runsAllowed}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `}};ct([a({type:Array})],Y.prototype,"standings",2),ct([a({type:String,attribute:"standings-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],Y.prototype,"standingsJson",1),Y=ct([v("baseball-standings-table")],Y);var ce=Object.defineProperty,de=Object.getOwnPropertyDescriptor,dt=(i,t,e,r)=>{for(var s=r>1?void 0:r?de(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&ce(t,e,s),s};let Q=class extends y{constructor(){super(...arguments),this.games=[]}createRenderRoot(){return this}set gamesJson(i){this.games=i}onScoreGame(i){this.dispatchEvent(new CustomEvent("score-game-click",{detail:{gameId:i},bubbles:!0}))}onBoxScore(i){this.dispatchEvent(new CustomEvent("box-score-click",{detail:{gameId:i},bubbles:!0}))}render(){return c`
      <div class="card">
        <h3>Games Schedule (${this.games.length})</h3>
        ${this.games.length===0?c`<p class="text-muted">No games scheduled yet.</p>`:c`
              <div class="schedule-list">
                ${this.games.map(i=>c`
                    <div class="game-card flex-between">
                      <div>
                        <div class="font-bold">${i.awayTeam} @ ${i.homeTeam}</div>
                        <div class="text-muted font-small margin-top-xs">Date: ${i.date} | Status: ${i.status}</div>
                      </div>
                      <div class="flex-center flex-gap-sm">
                        ${i.status==="COMPLETED"?c`
                              <span class="font-bold margin-right-md">${i.awayScore} - ${i.homeScore}</span>
                              <button class="btn btn-secondary" @click=${()=>this.onBoxScore(i.id)}>Box Score</button>
                            `:c`
                              <button class="btn btn-primary" @click=${()=>this.onScoreGame(i.id)}>Score Game</button>
                            `}
                      </div>
                    </div>
                  `)}
              </div>
            `}
      </div>
    `}};dt([a({type:Array})],Q.prototype,"games",2),dt([a({type:String,attribute:"games-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],Q.prototype,"gamesJson",1),Q=dt([v("baseball-schedule-list")],Q);var pe=Object.defineProperty,ue=Object.getOwnPropertyDescriptor,C=(i,t,e,r)=>{for(var s=r>1?void 0:r?ue(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&pe(t,e,s),s};let A=class extends y{constructor(){super(...arguments),this.title="League Leaders",this.col1Name="AVG",this.col2Name="HR",this.col3Name="RBI",this.rows=[]}createRenderRoot(){return this}set rowsJson(i){this.rows=i}render(){return c`
      <div class="card">
        <h2>${this.title}</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>GP</th>
                <th>${this.col1Name}</th>
                <th>${this.col2Name}</th>
                <th>${this.col3Name}</th>
              </tr>
            </thead>
            <tbody>
              ${this.rows.map(i=>c`
                  <tr>
                    <td class="font-bold">${i.playerName}</td>
                    <td class="text-secondary">${i.teamName}</td>
                    <td>${i.games}</td>
                    <td class="font-bold text-accent-yellow">${i.stat1}</td>
                    <td class="font-bold">${i.stat2}</td>
                    <td>${i.stat3}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `}};C([a({type:String})],A.prototype,"title",2),C([a({type:String,attribute:"col1-name"})],A.prototype,"col1Name",2),C([a({type:String,attribute:"col2-name"})],A.prototype,"col2Name",2),C([a({type:String,attribute:"col3-name"})],A.prototype,"col3Name",2),C([a({type:Array})],A.prototype,"rows",2),C([a({type:String,attribute:"rows-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],A.prototype,"rowsJson",1),A=C([v("baseball-stats-table")],A);var me=Object.defineProperty,be=Object.getOwnPropertyDescriptor,X=(i,t,e,r)=>{for(var s=r>1?void 0:r?be(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&me(t,e,s),s};let z=class extends y{constructor(){super(...arguments),this.teamName="Team Roster",this.players=[]}createRenderRoot(){return this}set playersJson(i){this.players=i}render(){return c`
      <div class="card">
        <h2>${this.teamName} Roster (${this.players.length})</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>POS</th>
                <th>BATS</th>
                <th>THROWS</th>
              </tr>
            </thead>
            <tbody>
              ${this.players.map(i=>c`
                  <tr>
                    <td class="font-bold text-accent-yellow">#${i.jerseyNumber}</td>
                    <td class="font-bold">${i.name}</td>
                    <td class="text-secondary">${i.position}</td>
                    <td>${i.battingHand}</td>
                    <td>${i.throwingHand}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `}};X([a({type:String,attribute:"team-name"})],z.prototype,"teamName",2),X([a({type:Array})],z.prototype,"players",2),X([a({type:String,attribute:"players-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],z.prototype,"playersJson",1),z=X([v("baseball-roster-table")],z);var $e=Object.defineProperty,ye=Object.getOwnPropertyDescriptor,k=(i,t,e,r)=>{for(var s=r>1?void 0:r?ye(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&$e(t,e,s),s};let W=class extends y{constructor(){super(...arguments),this.leagueName="",this.season="",this.teamCount=0}createRenderRoot(){return this}render(){return c`
      <div class="card flex-between">
        <div>
          <h2 class="text-accent-green font-bold">${this.leagueName}</h2>
          <div class="text-muted font-small margin-top-xs">Season: ${this.season} | Teams: ${this.teamCount}</div>
        </div>
        <button class="btn btn-secondary">Manage League</button>
      </div>
    `}};k([a({type:String,attribute:"league-name"})],W.prototype,"leagueName",2),k([a({type:String})],W.prototype,"season",2),k([a({type:Number,attribute:"team-count"})],W.prototype,"teamCount",2),W=k([v("baseball-league-card")],W)})();
