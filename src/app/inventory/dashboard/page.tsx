"use client"

import { useInventoryStore } from "@/store/useInventoryStore"
import { Package, AlertTriangle, Hammer, Search, Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { useTranslations } from "next-intl"

const STATUS_LABEL_KEY: Record<string, string> = {
  "Active": "stock.statusActive",
  "Low Stock": "stock.statusLowStock",
  "Maintenance Required": "stock.statusMaintenanceRequired",
}

export default function InventoryDashboard() {
  const t = useTranslations("inventory")
  const { totalAssetsValue, lowStockItems, assets } = useInventoryStore()

  const maintenanceAlerts = assets.filter(a => a.aiMaintenanceAlert)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h1>
          <p className="text-sm text-slate-500">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: t('dashboard.kpiTotalAssetValue'), value: `₹${(totalAssetsValue / 10000000).toFixed(2)}Cr`, icon: Package,       cardBg: 'bg-amber-50/70',  ib: 'text-amber-600',  lb: 'text-amber-800/60' },
          { label: t('dashboard.kpiLowStockAlerts'),  value: lowStockItems,                                    icon: AlertTriangle, cardBg: 'bg-red-50/70',    ib: 'text-red-600',    lb: 'text-red-800/60' },
          { label: t('dashboard.kpiMaintenanceTasks'), value: maintenanceAlerts.length,                         icon: Hammer,        cardBg: 'bg-[rgba(238,107,38,0.07)]/70',   ib: 'text-[var(--color-accent)]',   lb: 'text-[var(--color-primary-dark)]/60' },
        ].map(({ label, value, icon: Icon, cardBg, ib, lb }) => (
          <div key={label} className={`rounded-xl ${cardBg} p-4 flex items-center gap-4`}>
            <div className="p-3 rounded-xl bg-white shadow-sm flex-shrink-0">
              <Icon className={`h-5 w-5 ${ib}`} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${lb}`}>{label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">{t("dashboard.criticalAssets")}</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("dashboard.searchAssets")}
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <Card className="overflow-hidden border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">{t("dashboard.colAssetIdName")}</th>
                  <th className="px-6 py-4 font-semibold">{t("dashboard.colCategory")}</th>
                  <th className="px-6 py-4 font-semibold">{t("dashboard.colStatusQty")}</th>
                  <th className="px-6 py-4 font-semibold text-right">{t("dashboard.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map(asset => (
                  <tr key={asset.id} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{asset.name}</p>
                      <p className="text-xs text-slate-500">{asset.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-500 font-medium">{asset.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <NeonBadge
                        variant={asset.status === 'Maintenance Required' || asset.status === 'Low Stock' ? 'danger' : 'success'}
                      >
                        {STATUS_LABEL_KEY[asset.status] ? t(STATUS_LABEL_KEY[asset.status]) : asset.status} {asset.quantity ? `(${asset.quantity})` : ''}
                      </NeonBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-md transition-colors cursor-pointer">
                        {t("dashboard.manage")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">{t("dashboard.predictiveAlerts")}</h2>
          {maintenanceAlerts.length > 0 ? (
            <div className="space-y-4">
              {maintenanceAlerts.map(alert => (
                <Card key={alert.id} className="p-4 bg-red-50/80 shadow-sm">
                  <div className="flex gap-3">
                    <Activity className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-bold text-red-900 text-sm">{alert.name}</p>
                      <p className="text-xs font-medium text-red-700 mt-1">{alert.aiMaintenanceAlert}</p>
                      <button className="mt-3 text-xs font-bold text-white bg-red-600 px-3 py-1.5 rounded hover:bg-red-700 transition-colors cursor-pointer">
                        {t("dashboard.scheduleRepair")}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-slate-500 border-dashed">
              <p className="text-sm font-medium">{t("dashboard.noAlerts")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
