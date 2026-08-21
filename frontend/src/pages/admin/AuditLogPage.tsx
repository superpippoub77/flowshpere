import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Stack, Typography, Paper, TextField, MenuItem, Grid } from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { GridHeaderFilter } from "../../components/GridHeaderFilter";

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [companyId, setCompanyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => (await api.get("/admin/companies")).data,
  });

  const { data, isFetching } = useQuery({
    queryKey: ["audit-logs", companyId, dateFrom, dateTo, filterModel, page],
    queryFn: async () => (await api.get("/admin/audit-logs", { companyId, dateFrom, dateTo, filterModel: JSON.stringify(filterModel), page: page + 1 })).data,
  });

  const items = data?.items ?? [];

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "createdAt", headerName: "Quando", width: 170, filterable: false, valueFormatter: (p) => dayjs(p.value as string).format("DD/MM/YYYY HH:mm:ss") },
      {
        field: "action",
        renderHeader: () => <GridHeaderFilter field="action" label="Azione" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 1.4,
        minWidth: 280,
      },
      {
        field: "companyName",
        renderHeader: () => <GridHeaderFilter field="companyName" label="Azienda" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 0.7,
        minWidth: 160,
        valueGetter: (p) => p.row.companyName ?? "Globale",
      },
      {
        field: "userName",
        renderHeader: () => <GridHeaderFilter field="userName" label="Utente" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 0.7,
        minWidth: 160,
        valueGetter: (p) => p.row.userName ?? "Sistema",
      },
      { field: "ip", headerName: "IP", width: 130, filterable: false, valueGetter: (p) => p.row.ip ?? "—" },
    ],
    [filterModel, setFilterModel]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          AMMINISTRAZIONE
        </Typography>
        <Typography variant="h5">Registro attività (Audit Log)</Typography>
        <Typography variant="body2" color="text.secondary">
          Ogni creazione, modifica o cancellazione rilevante nell'applicazione, con chi l'ha fatta e quando.
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Azienda"
              size="small"
              fullWidth
              value={companyId}
              onChange={(e) => {
                setPage(0);
                setCompanyId(e.target.value);
              }}
            >
              <MenuItem value="">Tutte (incluse azioni globali)</MenuItem>
              {(companies ?? []).map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              label="Dal"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dateFrom}
              onChange={(e) => {
                setPage(0);
                setDateFrom(e.target.value);
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              label="Al"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dateTo}
              onChange={(e) => {
                setPage(0);
                setDateTo(e.target.value);
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ height: 560, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={items}
          columns={columns}
          loading={isFetching}
          columnHeaderHeight={64}
          paginationMode="server"
          filterMode="server"
          rowCount={data?.total ?? 0}
          paginationModel={{ page, pageSize: data?.pageSize ?? 25 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[25]}
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessuna voce trovata con questi filtri." }}
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
}
