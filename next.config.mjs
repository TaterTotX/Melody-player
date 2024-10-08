/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    assetPrefix: './', // 确保静态资源路径为相对路径
    trailingSlash: true, // 在每个 URL 后面加上一个斜杠
};

export default nextConfig;
