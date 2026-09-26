import { AuditOutlined, CalendarOutlined, IdcardOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '../constants/enums';
import { useAuthStore } from '../stores/authStore';
const { Sider, Content } = Layout;
export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout, can } = useAuthStore();
  const items = [
    { key: 'jobs', icon: <IdcardOutlined />, label: '职位管理' },
    { key: 'candidates', icon: <TeamOutlined />, label: '候选人' },
    { key: 'interviews', icon: <CalendarOutlined />, label: '面试日历' },
  ];
  // Offer 审批工作台仅招聘经理 / 管理员可见
  if (can([UserRole.HIRING_MANAGER, UserRole.ADMIN])) {
    items.push({ key: 'offers', icon: <AuditOutlined />, label: 'Offer 审批' });
  }
  return (
    <Layout className="app-shell">
      <Sider className="sidebar" width={236}>
        <div className="brand">TalentFlow</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[loc.pathname.split('/')[1] || 'jobs']}
          onClick={(e) => nav('/' + e.key)}
          items={items}
        />
        <div style={{ position: 'absolute', bottom: 18, left: 18, right: 18, color: '#f6f0df' }}>
          <Typography.Text style={{ color: '#f6f0df' }}>{user?.name} · {user?.role}</Typography.Text>
          <Button block icon={<LogoutOutlined />} style={{ marginTop: 10 }} onClick={() => { logout(); nav('/login'); }}>
            退出
          </Button>
        </div>
      </Sider>
      <Content className="content-band"><Outlet /></Content>
    </Layout>
  );
}
