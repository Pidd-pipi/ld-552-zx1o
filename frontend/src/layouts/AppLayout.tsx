import { AuditOutlined, CalendarOutlined, IdcardOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
const { Sider, Content } = Layout;
export default function AppLayout() {
  const nav = useNavigate(); const loc = useLocation(); const { user, logout } = useAuthStore();
  const offerItem = { key: 'offers', icon: <AuditOutlined />, label: user?.role === 'HIRING_MANAGER' ? 'Offer 审批' : 'Offer 管理' };
  const menuItems = [
    { key: 'jobs', icon: <IdcardOutlined />, label: '职位管理' },
    { key: 'candidates', icon: <TeamOutlined />, label: '候选人' },
    ...(user?.role === 'INTERVIEWER' ? [] : [offerItem]),
    { key: 'interviews', icon: <CalendarOutlined />, label: '面试日历' },
  ];
  return <Layout className="app-shell"><Sider className="sidebar" width={236}><div className="brand">TalentFlow</div><Menu theme="dark" mode="inline" selectedKeys={[loc.pathname.split('/')[1] || 'jobs']} onClick={(e)=>nav('/'+e.key)} items={menuItems} /><div style={{position:'absolute',bottom:18,left:18,right:18,color:'#f6f0df'}}><Typography.Text style={{color:'#f6f0df'}}>{user?.name} · {user?.role}</Typography.Text><Button block icon={<LogoutOutlined/>} style={{marginTop:10}} onClick={()=>{logout();nav('/login')}}>退出</Button></div></Sider><Content className="content-band"><Outlet/></Content></Layout>;
}
