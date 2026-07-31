(function(){"use strict";/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var vt;const F=globalThis,G=F.ShadowRoot&&(F.ShadyCSS===void 0||F.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,st=Symbol(),rt=new WeakMap;let _t=class{constructor(t,e,r){if(this._$cssResult$=!0,r!==st)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(G&&t===void 0){const r=e!==void 0&&e.length===1;r&&(t=rt.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),r&&rt.set(e,t))}return t}toString(){return this.cssText}};const gt=i=>new _t(typeof i=="string"?i:i+"",void 0,st),At=(i,t)=>{if(G)i.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const r=document.createElement("style"),s=F.litNonce;s!==void 0&&r.setAttribute("nonce",s),r.textContent=e.cssText,i.appendChild(r)}},it=G?i=>i:i=>i instanceof CSSStyleSheet?(t=>{let e="";for(const r of t.cssRules)e+=r.cssText;return gt(e)})(i):i;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:St,defineProperty:Et,getOwnPropertyDescriptor:wt,getOwnPropertyNames:Pt,getOwnPropertySymbols:Nt,getPrototypeOf:Ot}=Object,v=globalThis,nt=v.trustedTypes,Ct=nt?nt.emptyScript:"",J=v.reactiveElementPolyfillSupport,R=(i,t)=>i,k={toAttribute(i,t){switch(t){case Boolean:i=i?Ct:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,t){let e=i;switch(t){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},K=(i,t)=>!St(i,t),ot={attribute:!0,type:String,converter:k,reflect:!1,useDefault:!1,hasChanged:K};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),v.litPropertyMetadata??(v.litPropertyMetadata=new WeakMap);let O=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=ot){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const r=Symbol(),s=this.getPropertyDescriptor(t,r,e);s!==void 0&&Et(this.prototype,t,s)}}static getPropertyDescriptor(t,e,r){const{get:s,set:n}=wt(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:s,set(o){const h=s==null?void 0:s.call(this);n==null||n.call(this,o),this.requestUpdate(t,h,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ot}static _$Ei(){if(this.hasOwnProperty(R("elementProperties")))return;const t=Ot(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(R("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(R("properties"))){const e=this.properties,r=[...Pt(e),...Nt(e)];for(const s of r)this.createProperty(s,e[s])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[r,s]of e)this.elementProperties.set(r,s)}this._$Eh=new Map;for(const[e,r]of this.elementProperties){const s=this._$Eu(e,r);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const r=new Set(t.flat(1/0).reverse());for(const s of r)e.unshift(it(s))}else t!==void 0&&e.push(it(t));return e}static _$Eu(t,e){const r=e.attribute;return r===!1?void 0:typeof r=="string"?r:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const r of e.keys())this.hasOwnProperty(r)&&(t.set(r,this[r]),delete this[r]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return At(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var r;return(r=e.hostConnected)==null?void 0:r.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var r;return(r=e.hostDisconnected)==null?void 0:r.call(e)})}attributeChangedCallback(t,e,r){this._$AK(t,r)}_$ET(t,e){var n;const r=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,r);if(s!==void 0&&r.reflect===!0){const o=(((n=r.converter)==null?void 0:n.toAttribute)!==void 0?r.converter:k).toAttribute(e,r.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){var n,o;const r=this.constructor,s=r._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const h=r.getPropertyOptions(s),a=typeof h.converter=="function"?{fromAttribute:h.converter}:((n=h.converter)==null?void 0:n.fromAttribute)!==void 0?h.converter:k;this._$Em=s;const p=a.fromAttribute(e,h.type);this[s]=p??((o=this._$Ej)==null?void 0:o.get(s))??p,this._$Em=null}}requestUpdate(t,e,r,s=!1,n){var o;if(t!==void 0){const h=this.constructor;if(s===!1&&(n=this[t]),r??(r=h.getPropertyOptions(t)),!((r.hasChanged??K)(n,e)||r.useDefault&&r.reflect&&n===((o=this._$Ej)==null?void 0:o.get(t))&&!this.hasAttribute(h._$Eu(t,r))))return;this.C(t,e,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:r,reflect:s,wrapped:n},o){r&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||r||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var r;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,o]of this._$Ep)this[n]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[n,o]of s){const{wrapped:h}=o,a=this[n];h!==!0||this._$AL.has(n)||a===void 0||this.C(n,void 0,o,a)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(r=this._$EO)==null||r.forEach(s=>{var n;return(n=s.hostUpdate)==null?void 0:n.call(s)}),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(r=>{var s;return(s=r.hostUpdated)==null?void 0:s.call(r)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};O.elementStyles=[],O.shadowRootOptions={mode:"open"},O[R("elementProperties")]=new Map,O[R("finalized")]=new Map,J==null||J({ReactiveElement:O}),(v.reactiveElementVersions??(v.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const H=globalThis,at=i=>i,z=H.trustedTypes,ht=z?z.createPolicy("lit-html",{createHTML:i=>i}):void 0,lt="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,ct="?"+_,xt=`<${ct}>`,S=document,U=()=>S.createComment(""),B=i=>i===null||typeof i!="object"&&typeof i!="function",Z=Array.isArray,Tt=i=>Z(i)||typeof(i==null?void 0:i[Symbol.iterator])=="function",Y=`[ 	
\f\r]`,M=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,dt=/-->/g,pt=/>/g,E=RegExp(`>|${Y}(?:([^\\s"'>=/]+)(${Y}*=${Y}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ut=/'/g,$t=/"/g,mt=/^(?:script|style|textarea|title)$/i,Rt=i=>(t,...e)=>({_$litType$:i,strings:t,values:e}),b=Rt(1),C=Symbol.for("lit-noChange"),$=Symbol.for("lit-nothing"),bt=new WeakMap,w=S.createTreeWalker(S,129);function ft(i,t){if(!Z(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return ht!==void 0?ht.createHTML(t):t}const Ht=(i,t)=>{const e=i.length-1,r=[];let s,n=t===2?"<svg>":t===3?"<math>":"",o=M;for(let h=0;h<e;h++){const a=i[h];let p,m,c=-1,y=0;for(;y<a.length&&(o.lastIndex=y,m=o.exec(a),m!==null);)y=o.lastIndex,o===M?m[1]==="!--"?o=dt:m[1]!==void 0?o=pt:m[2]!==void 0?(mt.test(m[2])&&(s=RegExp("</"+m[2],"g")),o=E):m[3]!==void 0&&(o=E):o===E?m[0]===">"?(o=s??M,c=-1):m[1]===void 0?c=-2:(c=o.lastIndex-m[2].length,p=m[1],o=m[3]===void 0?E:m[3]==='"'?$t:ut):o===$t||o===ut?o=E:o===dt||o===pt?o=M:(o=E,s=void 0);const A=o===E&&i[h+1].startsWith("/>")?" ":"";n+=o===M?a+xt:c>=0?(r.push(p),a.slice(0,c)+lt+a.slice(c)+_+A):a+_+(c===-2?h:A)}return[ft(i,n+(i[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),r]};class D{constructor({strings:t,_$litType$:e},r){let s;this.parts=[];let n=0,o=0;const h=t.length-1,a=this.parts,[p,m]=Ht(t,e);if(this.el=D.createElement(p,r),w.currentNode=this.el.content,e===2||e===3){const c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(s=w.nextNode())!==null&&a.length<h;){if(s.nodeType===1){if(s.hasAttributes())for(const c of s.getAttributeNames())if(c.endsWith(lt)){const y=m[o++],A=s.getAttribute(c).split(_),q=/([.?@])?(.*)/.exec(y);a.push({type:1,index:n,name:q[2],strings:A,ctor:q[1]==="."?Bt:q[1]==="?"?Mt:q[1]==="@"?Dt:W}),s.removeAttribute(c)}else c.startsWith(_)&&(a.push({type:6,index:n}),s.removeAttribute(c));if(mt.test(s.tagName)){const c=s.textContent.split(_),y=c.length-1;if(y>0){s.textContent=z?z.emptyScript:"";for(let A=0;A<y;A++)s.append(c[A],U()),w.nextNode(),a.push({type:2,index:++n});s.append(c[y],U())}}}else if(s.nodeType===8)if(s.data===ct)a.push({type:2,index:n});else{let c=-1;for(;(c=s.data.indexOf(_,c+1))!==-1;)a.push({type:7,index:n}),c+=_.length-1}n++}}static createElement(t,e){const r=S.createElement("template");return r.innerHTML=t,r}}function x(i,t,e=i,r){var o,h;if(t===C)return t;let s=r!==void 0?(o=e._$Co)==null?void 0:o[r]:e._$Cl;const n=B(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==n&&((h=s==null?void 0:s._$AO)==null||h.call(s,!1),n===void 0?s=void 0:(s=new n(i),s._$AT(i,e,r)),r!==void 0?(e._$Co??(e._$Co=[]))[r]=s:e._$Cl=s),s!==void 0&&(t=x(i,s._$AS(i,t.values),s,r)),t}class Ut{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:r}=this._$AD,s=((t==null?void 0:t.creationScope)??S).importNode(e,!0);w.currentNode=s;let n=w.nextNode(),o=0,h=0,a=r[0];for(;a!==void 0;){if(o===a.index){let p;a.type===2?p=new j(n,n.nextSibling,this,t):a.type===1?p=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(p=new jt(n,this,t)),this._$AV.push(p),a=r[++h]}o!==(a==null?void 0:a.index)&&(n=w.nextNode(),o++)}return w.currentNode=S,s}p(t){let e=0;for(const r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(t,r,e),e+=r.strings.length-2):r._$AI(t[e])),e++}}class j{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,r,s){this.type=2,this._$AH=$,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=r,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=x(this,t,e),B(t)?t===$||t==null||t===""?(this._$AH!==$&&this._$AR(),this._$AH=$):t!==this._$AH&&t!==C&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Tt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==$&&B(this._$AH)?this._$AA.nextSibling.data=t:this.T(S.createTextNode(t)),this._$AH=t}$(t){var n;const{values:e,_$litType$:r}=t,s=typeof r=="number"?this._$AC(t):(r.el===void 0&&(r.el=D.createElement(ft(r.h,r.h[0]),this.options)),r);if(((n=this._$AH)==null?void 0:n._$AD)===s)this._$AH.p(e);else{const o=new Ut(s,this),h=o.u(this.options);o.p(e),this.T(h),this._$AH=o}}_$AC(t){let e=bt.get(t.strings);return e===void 0&&bt.set(t.strings,e=new D(t)),e}k(t){Z(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let r,s=0;for(const n of t)s===e.length?e.push(r=new j(this.O(U()),this.O(U()),this,this.options)):r=e[s],r._$AI(n),s++;s<e.length&&(this._$AR(r&&r._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){var r;for((r=this._$AP)==null?void 0:r.call(this,!1,!0,e);t!==this._$AB;){const s=at(t).nextSibling;at(t).remove(),t=s}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class W{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,r,s,n){this.type=1,this._$AH=$,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=$}_$AI(t,e=this,r,s){const n=this.strings;let o=!1;if(n===void 0)t=x(this,t,e,0),o=!B(t)||t!==this._$AH&&t!==C,o&&(this._$AH=t);else{const h=t;let a,p;for(t=n[0],a=0;a<n.length-1;a++)p=x(this,h[r+a],e,a),p===C&&(p=this._$AH[a]),o||(o=!B(p)||p!==this._$AH[a]),p===$?t=$:t!==$&&(t+=(p??"")+n[a+1]),this._$AH[a]=p}o&&!s&&this.j(t)}j(t){t===$?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Bt extends W{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===$?void 0:t}}class Mt extends W{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==$)}}class Dt extends W{constructor(t,e,r,s,n){super(t,e,r,s,n),this.type=5}_$AI(t,e=this){if((t=x(this,t,e,0)??$)===C)return;const r=this._$AH,s=t===$&&r!==$||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,n=t!==$&&(r===$||s);s&&this.element.removeEventListener(this.name,this,r),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class jt{constructor(t,e,r){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(t){x(this,t)}}const Q=H.litHtmlPolyfillSupport;Q==null||Q(D,j),(H.litHtmlVersions??(H.litHtmlVersions=[])).push("3.3.3");const It=(i,t,e)=>{const r=(e==null?void 0:e.renderBefore)??t;let s=r._$litPart$;if(s===void 0){const n=(e==null?void 0:e.renderBefore)??null;r._$litPart$=s=new j(t.insertBefore(U(),n),n,void 0,e??{})}return s._$AI(i),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const P=globalThis;class f extends O{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=It(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return C}}f._$litElement$=!0,f.finalized=!0,(vt=P.litElementHydrateSupport)==null||vt.call(P,{LitElement:f});const X=P.litElementPolyfillSupport;X==null||X({LitElement:f}),(P.litElementVersions??(P.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const I=i=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,t)}):customElements.define(i,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Lt={attribute:!0,type:String,converter:k,reflect:!1,hasChanged:K},Ft=(i=Lt,t,e)=>{const{kind:r,metadata:s}=e;let n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),r==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(e.name,i),r==="accessor"){const{name:o}=e;return{set(h){const a=t.get.call(this);t.set.call(this,h),this.requestUpdate(o,a,i,!0,h)},init(h){return h!==void 0&&this.C(o,void 0,i,h),h}}}if(r==="setter"){const{name:o}=e;return function(h){const a=this[o];t.call(this,h),this.requestUpdate(o,a,i,!0,h)}}throw Error("Unsupported decorator location: "+r)};function l(i){return(t,e)=>typeof e=="object"?Ft(i,t,e):((r,s,n)=>{const o=s.hasOwnProperty(n);return s.constructor.createProperty(n,r),o?Object.getOwnPropertyDescriptor(s,n):void 0})(i,t,e)}var kt=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,u=(i,t,e,r)=>{for(var s=r>1?void 0:r?zt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&kt(t,e,s),s};let d=class extends f{constructor(){super(...arguments),this.awayName="AWAY",this.homeName="HOME",this.awayScore=0,this.homeScore=0,this.awayHits=0,this.homeHits=0,this.awayErrors=0,this.homeErrors=0,this.inning=1,this.half="TOP",this.balls=0,this.strikes=0,this.outs=0,this.runnerFirst=!1,this.runnerSecond=!1,this.runnerThird=!1,this.runnerFirstName="",this.runnerSecondName="",this.runnerThirdName=""}createRenderRoot(){return this}render(){const i=this.half==="TOP"?"▲":"▼",t=this.outs===0?"No Outs":this.outs===1?"1 Out":this.outs===2?"2 Outs":"3 Outs";return b`
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
          ${this.runnerFirstName?b`<div>1B: ${this.runnerFirstName}</div>`:""}
          ${this.runnerSecondName?b`<div>2B: ${this.runnerSecondName}</div>`:""}
          ${this.runnerThirdName?b`<div>3B: ${this.runnerThirdName}</div>`:""}
        </div>
      </div>
    `}};u([l({type:String,attribute:"away-name"})],d.prototype,"awayName",2),u([l({type:String,attribute:"home-name"})],d.prototype,"homeName",2),u([l({type:Number,attribute:"away-score"})],d.prototype,"awayScore",2),u([l({type:Number,attribute:"home-score"})],d.prototype,"homeScore",2),u([l({type:Number,attribute:"away-hits"})],d.prototype,"awayHits",2),u([l({type:Number,attribute:"home-hits"})],d.prototype,"homeHits",2),u([l({type:Number,attribute:"away-errors"})],d.prototype,"awayErrors",2),u([l({type:Number,attribute:"home-errors"})],d.prototype,"homeErrors",2),u([l({type:Number})],d.prototype,"inning",2),u([l({type:String})],d.prototype,"half",2),u([l({type:Number})],d.prototype,"balls",2),u([l({type:Number})],d.prototype,"strikes",2),u([l({type:Number})],d.prototype,"outs",2),u([l({type:Boolean,attribute:"runner-first"})],d.prototype,"runnerFirst",2),u([l({type:Boolean,attribute:"runner-second"})],d.prototype,"runnerSecond",2),u([l({type:Boolean,attribute:"runner-third"})],d.prototype,"runnerThird",2),u([l({type:String,attribute:"runner-first-name"})],d.prototype,"runnerFirstName",2),u([l({type:String,attribute:"runner-second-name"})],d.prototype,"runnerSecondName",2),u([l({type:String,attribute:"runner-third-name"})],d.prototype,"runnerThirdName",2),d=u([I("baseball-scoreboard")],d);var Wt=Object.defineProperty,Vt=Object.getOwnPropertyDescriptor,tt=(i,t,e,r)=>{for(var s=r>1?void 0:r?Vt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&Wt(t,e,s),s};let V=class extends f{constructor(){super(...arguments),this.fielders=[]}createRenderRoot(){return this}set fieldersJson(i){this.fielders=i}render(){return b`
      <div class="field-diagram-card card">
        <h3>DEFENSIVE POSITIONS</h3>
        <div class="field-diagram-wrapper">
          <div id="field-diamond-bg"></div>
          ${["P","C","1B","2B","3B","SS","LF","CF","RF"].map(t=>{const e=this.fielders.find(s=>s.position===t),r=e?e.name:t;return b`
              <div class="field-position-badge pos-pos-${t}">
                <span class="font-bold">${t}: ${r}</span>
              </div>
            `})}
        </div>
      </div>
    `}};tt([l({type:Array})],V.prototype,"fielders",2),tt([l({type:String,attribute:"fielders-json",converter:{fromAttribute:i=>{if(!i)return[];try{return JSON.parse(i)}catch{return[]}}}})],V.prototype,"fieldersJson",1),V=tt([I("baseball-defense-diagram")],V);var qt=Object.defineProperty,Gt=Object.getOwnPropertyDescriptor,N=(i,t,e,r)=>{for(var s=r>1?void 0:r?Gt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&qt(t,e,s),s};let g=class extends f{constructor(){super(...arguments),this.teamName="TEAM",this.batters=[],this.lineScore=[0,0,0,0,0,0,0,0,0],this.totalRuns=0,this.totalHits=0,this.totalErrors=0}createRenderRoot(){return this}render(){const i=[1,2,3,4,5,6,7,8,9];return b`
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
                ${i.map(t=>b`<th>${t}</th>`)}
                <th>AB</th>
                <th>R</th>
                <th>H</th>
              </tr>
            </thead>
            <tbody>
              ${this.batters.map(t=>b`
                  <tr>
                    <td class="font-bold text-muted">${t.slot}</td>
                    <td class="font-bold">${t.batterName}</td>
                    <td class="text-secondary">${t.position}</td>
                    ${(t.innings||[]).map(e=>b`<td class="scorebook-cell ${e?"occupied-cell":""}">${e||""}</td>`)}
                    <td>${t.runs+t.hits}</td>
                    <td class="font-bold text-accent-yellow">${t.runs}</td>
                    <td class="font-bold">${t.hits}</td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `}};N([l({type:String,attribute:"team-name"})],g.prototype,"teamName",2),N([l({type:Array})],g.prototype,"batters",2),N([l({type:Array})],g.prototype,"lineScore",2),N([l({type:Number,attribute:"total-runs"})],g.prototype,"totalRuns",2),N([l({type:Number,attribute:"total-hits"})],g.prototype,"totalHits",2),N([l({type:Number,attribute:"total-errors"})],g.prototype,"totalErrors",2),g=N([I("baseball-scorebook-grid")],g);var Jt=Object.defineProperty,Kt=Object.getOwnPropertyDescriptor,L=(i,t,e,r)=>{for(var s=r>1?void 0:r?Kt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&Jt(t,e,s),s};let T=class extends f{constructor(){super(...arguments),this.batterName="None",this.batterStats="",this.pitcherName="None",this.pitcherStats=""}createRenderRoot(){return this}render(){return b`
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
    `}};L([l({type:String,attribute:"batter-name"})],T.prototype,"batterName",2),L([l({type:String,attribute:"batter-stats"})],T.prototype,"batterStats",2),L([l({type:String,attribute:"pitcher-name"})],T.prototype,"pitcherName",2),L([l({type:String,attribute:"pitcher-stats"})],T.prototype,"pitcherStats",2),T=L([I("baseball-matchup-card")],T);var Zt=Object.defineProperty,Yt=Object.getOwnPropertyDescriptor,yt=(i,t,e,r)=>{for(var s=r>1?void 0:r?Yt(t,e):t,n=i.length-1,o;n>=0;n--)(o=i[n])&&(s=(r?o(t,e,s):o(s))||s);return r&&s&&Zt(t,e,s),s};let et=class extends f{constructor(){super(...arguments),this.currentPitchType=null}createRenderRoot(){return this}selectPitchType(i){const t=this.currentPitchType===i?"":i;this.setAttribute("selected-pitch-type",t),this.dispatchEvent(new Event("pitch-type-selected",{bubbles:!0}))}triggerEvent(i){this.setAttribute("triggered-event-type",i),this.dispatchEvent(new Event("action-triggered",{bubbles:!0}))}triggerStep2(i,t){this.setAttribute("step2-event-type",i),this.setAttribute("step2-label",t),this.dispatchEvent(new Event("step2-requested",{bubbles:!0}))}render(){return b`
      <div class="flex-gap-sm margin-bottom-md">
        ${["Fastball","Breaking Ball","Offspeed"].map(t=>{const e=t===this.currentPitchType;return b`
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
    `}};yt([l({type:String,attribute:"current-pitch-type"})],et.prototype,"currentPitchType",2),et=yt([I("baseball-action-grid")],et)})();
