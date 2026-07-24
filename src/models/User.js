const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'password_hash'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  foto_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'foto_url'
  },
  auth_provider: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'LOCAL',
    field: 'auth_provider'
  },
  provider_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'provider_id'
  },
  rol: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  onboarding_completo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'onboarding_completo'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  habeas_data_accepted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'habeas_data_accepted_at'
  },
  habeas_data_ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'habeas_data_ip'
  }
}, {
  tableName: 'usuarios',
  timestamps: false
});

module.exports = User;
