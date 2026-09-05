import { getAdminSession } from '../../../../lib/admin-auth';
import { listBookings, listExpenses } from '../../../../db/bookings';

export async function GET(request: Request) {
  if ((await getAdminSession())?.role !== 'master') return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const type = new URL(request.url).searchParams.get('type') || 'financeiro';
  if (!['financeiro', 'agendamentos'].includes(type)) return Response.json({ error: 'Relatório inválido.' }, { status: 400 });
  const bookings = await listBookings();
  const rows: Array<Array<string | number>> = [];
  if (type === 'agendamentos') {
    rows.push(['Data', 'Horário', 'Cliente', 'WhatsApp', 'Serviço', 'Status', 'Pagamento', 'Total']);
    for (const booking of bookings) rows.push([booking.appointmentDate, booking.appointmentTime, booking.clientName, booking.whatsapp, booking.serviceLabel, booking.status, booking.paymentStatus, decimal(booking.priceCents)]);
  } else {
    rows.push(['Data', 'Tipo', 'Descrição', 'Cliente', 'Contratado', 'Recebido', 'A receber', 'Categoria']);
    for (const booking of bookings.filter((item) => item.paymentStatus === 'pago')) {
      const received = booking.paymentAmountCents + booking.balancePaidCents;
      rows.push([booking.appointmentDate, 'Receita', booking.serviceLabel, booking.clientName, decimal(booking.priceCents), decimal(received), decimal(Math.max(0, booking.priceCents - received)), 'Atendimento']);
    }
    for (const expense of await listExpenses()) rows.push([expense.expenseDate, 'Despesa', expense.description, '', '', decimal(expense.amountCents), '', expense.category]);
    rows.splice(1, rows.length - 1, ...rows.slice(1).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="savia-${type}-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}

function decimal(cents: number) { return (cents / 100).toFixed(2).replace('.', ','); }
function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
