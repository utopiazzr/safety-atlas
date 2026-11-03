import {createRoot, type Root} from 'react-dom/client';
import CloudComposer from '../CloudComposer';
import {LocaleSelect} from '../i18n';
import base from '../style.css?inline';
import forms from '../signals.css?inline';
import intake from '../intake.css?inline';
import cloud from '../cloud.css?inline';

type Request = {kind:string;seq:number;relatedId?:string;intent?:string};
let root:Root|null=null;
// Keep form drafts mounted across routes; isolate legacy form styling from the
// new presentation, while reusing the actual authenticated intake client.
export function mountSubmission(host:HTMLElement,request:Request){
 if(root){updateSubmission(request);return}
 host.replaceChildren();
 const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=[base,forms,intake,cloud,`
 :host{display:block;color:#e8ddc2;font:16px/1.6 "Microsoft YaHei",sans-serif;--red:#c25b38;--ink:#112b23;--cream:#e8ddc2;--paper:#e8ddc2;--muted:#babcae}
 .submission-shell{padding:32px;background:#10241fec;border:1px solid #a89570}
 .language-row{display:flex;justify-content:flex-end;margin-bottom:16px}
 .signal-composer{padding:0}.signal-composer h2{font-size:32px}.composer-heading{display:flex;align-items:center;gap:12px}
 input,textarea,select{max-width:100%;padding:12px;background:#102a24;color:#eee2c8;border:1px solid #7f8a78}
 textarea{width:100%;resize:vertical;min-height:100px}button{min-height:44px}
 .btn.orange{background:#bd5135;color:#fff2d7}.composer-intro{font-size:16px}
 *{animation:none!important;transition:none!important}.signal-composer{--line:#788878}
 @media(max-width:680px){.submission-shell{padding:20px 15px}.contribution-paths{grid-template-columns:1fr}.composer-heading h2{font-size:26px}}
 `].join('\n');
 const container=document.createElement('div');container.className='submission-shell';shadow.append(style,container);root=createRoot(container);updateSubmission(request);
}
export function updateSubmission(request:Request){
 root?.render(<><div className="language-row"><LocaleSelect/></div><CloudComposer repository="utopiazzr/safety-atlas" request={request}/></>);
}
