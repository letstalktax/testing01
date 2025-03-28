import { motion } from 'framer-motion';
import Link from 'next/link';

import { LogoMusTax, MessageIcon } from './icons';

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <div className="w-full flex justify-center">
          <LogoMusTax size={200} className="rounded-lg" />
        </div>
        
        <p>
          Welcome to MusTax AI - Your expert assistant for UAE Corporate Tax guidance. Created by{' '}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://www.linkedin.com/in/mustafa9811/"
            target="_blank"
          >
            Mustafa
          </Link>
          , this AI-powered chatbot specializes in providing comprehensive UAE Corporate Tax assistance.
        </p>
        <p>
          Get instant answers about tax registration, compliance requirements, free zone considerations,
          and more. Whether you need basic information or complex tax planning guidance, our AI models
          are here to help.
        </p>
      </div>
    </motion.div>
  );
};
