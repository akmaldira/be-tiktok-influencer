import{F as p,G as g,j as s,I as o,B as t,H as f,J as w,K as b,M as N,L as i,N as F,O as L,P as v}from"./index-dKOGJKRD.js";import{u as C,t as k,F as y,a as l,b as c,c as m,d,e as h,o as S,s as x,A as I}from"./form-sK-1KgrI.js";import{L as P}from"./log-in-ybuX85Pj.js";const A=async e=>await new p().post("/auth/login",e),M=S({email:x().email(),password:x().min(8)});function H(){const e=C({defaultValues:{email:"",password:""},resolver:k(M)}),{isSubmitting:r}=e.formState,j=g(),u=async a=>{const n=await A(a);if(n.error){w.error(n.error.message);return}localStorage.setItem("token",n.data.token),j("/app",{replace:!0})};return s.jsx(y,{...e,children:s.jsxs("form",{onSubmit:e.handleSubmit(u),children:[s.jsxs("div",{className:"space-y-3 mb-4",children:[s.jsx(l,{control:e.control,name:"email",render:({field:a})=>s.jsxs(c,{children:[s.jsx(m,{children:"Email"}),s.jsx(d,{children:s.jsx(o,{placeholder:"Masukkan email",...a})}),s.jsx(h,{})]})}),s.jsx(l,{control:e.control,name:"password",render:({field:a})=>s.jsxs(c,{children:[s.jsx(m,{children:"Password"}),s.jsx(d,{children:s.jsx(o,{type:"password",placeholder:"Masukkan password",...a})}),s.jsx(h,{})]})})]}),s.jsxs(t,{className:"w-full",type:"submit",disabled:r,children:[r?s.jsx(f,{className:"mr-2 w-4 h-4"}):s.jsx(P,{className:"w-4 h-4 mr-2"}),"Login"]})]})})}function D(){return s.jsx("main",{className:"h-dvh flex items-center justify-center bg-dots bg-no-repeat bg-cover",children:s.jsxs(b,{className:"w-full max-w-lg",children:[s.jsxs(N,{children:[s.jsx(t,{className:"w-fit mb-4",size:"sm",variant:"outline",asChild:!0,children:s.jsxs(i,{to:"/#home",children:[s.jsx(I,{className:"h-4 w-4 mr-2"})," Home"]})}),s.jsx(F,{children:"Login"}),s.jsx(L,{children:"Please fill the form below to login."})]}),s.jsxs(v,{children:[s.jsx(H,{}),s.jsxs("div",{className:"mt-4",children:[s.jsx("span",{className:"text-sm",children:"Don't have an account?"}),s.jsx(t,{size:"sm",variant:"link",asChild:!0,children:s.jsx(i,{to:"/auth/register",children:"register"})})]})]})]})})}export{D as default};